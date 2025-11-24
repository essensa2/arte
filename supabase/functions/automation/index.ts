import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Automation = {
  id: string;
  board_id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
};

type EventRow = {
  id: string;
  board_id: string;
  item_id: string;
  column_id: string;
  old_value: unknown;
  new_value: unknown;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

async function supabaseFetch(path: string, init?: RequestInit) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = new Headers(init?.headers);
  headers.set("apikey", SUPABASE_SERVICE_ROLE_KEY);
  headers.set("Authorization", `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set("Content-Type", "application/json");
  return fetch(url, { ...init, headers });
}

function equalsString(v: unknown, s: string): boolean {
  // Handle string directly
  if (typeof v === "string") return v === s;

  // Handle JSONB object with label property (status options)
  if (v && typeof v === "object") {
    const obj = v as any;
    // Check if it's a status option object with label
    if (obj.label && typeof obj.label === "string") {
      return obj.label === s;
    }
    // Try toString as fallback
    if ("toString" in obj) {
      try {
        return String(obj) === s;
      } catch {
        return false;
      }
    }
  }

  return false;
}

async function processStatusChanged(events: EventRow[], automations: Automation[]) {
  console.log(`Processing ${events.length} events with ${automations.length} automations`);
  for (const ev of events) {
    console.log(`Processing event:`, {
      item_id: ev.item_id,
      column_id: ev.column_id,
      new_value: ev.new_value,
      new_value_type: typeof ev.new_value
    });
    const matches = automations.filter((a) => {
      if (!a.is_active) {
        console.log(`Automation ${a.id} is not active`);
        return false;
      }
      if (a.trigger_type !== "STATUS_CHANGED") {
        console.log(`Automation ${a.id} trigger type is ${a.trigger_type}, not STATUS_CHANGED`);
        return false;
      }
      const cfg = a.trigger_config as { column_id?: string; target_status?: string };
      console.log(`Checking automation ${a.id}:`, {
        cfg_column_id: cfg.column_id,
        ev_column_id: ev.column_id,
        cfg_target_status: cfg.target_status,
        ev_new_value: ev.new_value,
        match_column: cfg.column_id ? cfg.column_id === ev.column_id : 'no column filter',
        match_status: cfg.target_status ? equalsString(ev.new_value, cfg.target_status) : 'no status filter'
      });
      if (cfg.column_id && cfg.column_id !== ev.column_id) {
        console.log(`Column ID mismatch: ${cfg.column_id} !== ${ev.column_id}`);
        return false;
      }
      // Handle target_status matching: null/empty means match when status is cleared/empty
      if (cfg.target_status !== undefined) {
        // If target_status is explicitly set to empty string or null, match when status is cleared/empty
        if (cfg.target_status === '' || cfg.target_status === null || cfg.target_status === 'Status...') {
          // Match when status is empty/null
          const isNewValueEmpty = ev.new_value === null || ev.new_value === undefined ||
            (typeof ev.new_value === 'string' && ev.new_value === '') ||
            (typeof ev.new_value === 'object' && (!ev.new_value || (ev.new_value as any).label === ''));
          if (!isNewValueEmpty) {
            console.log(`Status mismatch: expected empty but got ${JSON.stringify(ev.new_value)}`);
            return false;
          }
        } else if (!equalsString(ev.new_value, cfg.target_status)) {
          console.log(`Status mismatch: ${JSON.stringify(ev.new_value)} !== ${cfg.target_status}`);
          return false;
        }
      }
      console.log(`Automation ${a.id} matched!`);
      return true;
    });
    for (const rule of matches) {
      // Handle both old format (single action) and new format (array of actions)
      let actions: Array<{ type: string; config: any }> = [];
      if (Array.isArray(rule.action_config)) {
        // New format: array of actions [{type: 'MOVE_TO_GROUP', config: {...}}, ...]
        actions = rule.action_config;
      } else {
        // Old format: single action - convert to array format for backward compatibility
        actions = [{ type: rule.action_type, config: rule.action_config }];
      }

      // Execute all actions in sequence
      for (const action of actions) {
        try {
          if (action.type === "MOVE_TO_BOARD") {
            const cfg = action.config as { dest_board_id: string; new_status?: string; status_column_id?: string; archive_source?: boolean };
            await moveItem(ev.item_id, ev.board_id, cfg.dest_board_id, cfg.new_status, cfg.status_column_id, cfg.archive_source ?? true);
          } else if (action.type === "MOVE_TO_GROUP") {
            const cfg = action.config as { dest_group_id: string };
            await moveItemToGroup(ev.item_id, cfg.dest_group_id);
          } else if (action.type === "SEND_EMAIL") {
            const cfg = action.config as {
              email_template: string;
              from?: string;
              to?: string;
              cc?: string;
              bcc?: string;
              subject?: string;
              after_status?: string;
              after_status_column_id?: string
            };
            await sendEmail(rule.id, ev.item_id, ev.board_id, ev.column_id, cfg.email_template, cfg.from, cfg.to, cfg.cc, cfg.bcc, cfg.subject, cfg.after_status, cfg.after_status_column_id);
          } else if (action.type === "CALL_WEBHOOK") {
            const cfg = action.config as { url: string; payload?: unknown };
            const webhookPayload = {
              automation_id: rule.id,
              board_id: ev.board_id,
              item_id: ev.item_id,
              column_id: ev.column_id,
              old_value: ev.old_value,
              new_value: ev.new_value,
              payload: cfg.payload ?? null
            };
            await callWebhook(rule.id, cfg.url, webhookPayload, ev.item_id, ev.board_id, ev.column_id);
          } else if (action.type === "CHANGE_STATUS") {
            const cfg = action.config as { status_column_id: string; status_value: string };
            await changeStatus(ev.item_id, cfg.status_column_id, cfg.status_value);
          } else if (action.type === "AI_FILL_FIELDS") {
            const cfg = action.config as {
              ai_instructions: string;
              field_mappings: Array<{ column_id: string; instruction: string }>;
            };
            await aiFillFields(rule.id, ev.item_id, ev.board_id, cfg.ai_instructions, cfg.field_mappings);
          }
        } catch (error) {
          console.error(`Error executing action ${action.type}:`, error);
          await logAutomation(rule.id, "error", `Failed to execute ${action.type}: ${(error as Error).message}`);
        }
      }
      await logAutomation(rule.id, "success", `Processed event ${ev.id} with ${actions.length} action(s)`);
    }
  }
}

async function moveItem(itemId: string, sourceBoardId: string, destBoardId: string, newStatus?: string, statusColumnId?: string, archiveSource: boolean = true) {
  // Fetch item and cell_values
  const itemRes = await supabaseFetch(`items?id=eq.${itemId}&select=id,board_id,name,position`);
  const [item] = await itemRes.json() as any[];
  if (!item) return;
  const cellsRes = await supabaseFetch(`cell_values?item_id=eq.${itemId}&select=item_id,column_id,value`);
  const cells = await cellsRes.json() as any[];
  // Create new item
  const destItemRes = await supabaseFetch(`items?select=id`, {
    method: "POST",
    body: JSON.stringify([{ board_id: destBoardId, name: item.name, position: 999999 }])
  });
  const [destItem] = await destItemRes.json() as any[];
  // Copy cell values
  if (cells.length) {
    const payload = cells.map((c) => ({
      item_id: destItem.id,
      column_id: c.column_id,
      value: c.value
    }));
    await supabaseFetch(`cell_values`, { method: "POST", body: JSON.stringify(payload) });
  }
  // Optional: set status in destination
  if (newStatus && statusColumnId) {
    await supabaseFetch(`cell_values`, {
      method: "POST",
      body: JSON.stringify([{ item_id: destItem.id, column_id: statusColumnId, value: newStatus }])
    });
  }
  // Archive or delete the source
  if (archiveSource) {
    await supabaseFetch(`items?id=eq.${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ archived_at: new Date().toISOString() })
    });
  } else {
    await supabaseFetch(`items?id=eq.${itemId}`, { method: "DELETE" });
  }
}

async function moveItemToGroup(itemId: string, destGroupId: string) {
  console.log(`[moveItemToGroup] Starting - itemId: ${itemId}, destGroupId: ${destGroupId}`);

  // Get current item position in the destination group to place at end
  const groupItemsRes = await supabaseFetch(`items?group_id=eq.${destGroupId}&select=position&order=position.desc&limit=1`);
  const groupItems = await groupItemsRes.json() as any[];
  const newPosition = groupItems.length > 0 ? (groupItems[0].position ?? 0) + 1 : 0;
  console.log(`[moveItemToGroup] Calculated new position: ${newPosition}, existing items in group: ${groupItems.length}`);

  // Update item's group_id and position - add select=* to get the updated data back
  const updateRes = await supabaseFetch(`items?id=eq.${itemId}&select=*`, {
    method: "PATCH",
    body: JSON.stringify({ group_id: destGroupId, position: newPosition })
  });

  console.log(`[moveItemToGroup] Update response status: ${updateRes.status}`);

  if (!updateRes.ok) {
    const errorText = await updateRes.text();
    console.error(`[moveItemToGroup] Failed to move item: ${errorText}`);
    throw new Error(`Failed to move item: ${errorText}`);
  }

  const updateData = await updateRes.json();
  console.log(`[moveItemToGroup] Update successful, updated ${updateData.length} row(s)`);
  console.log(`[moveItemToGroup] Successfully moved item ${itemId} to group ${destGroupId}`);
}


async function sendEmail(
  automationId: string,
  itemId: string,
  boardId: string,
  statusColumnId: string,
  template: string,
  fromEmail?: string,
  toEmail?: string,
  ccEmail?: string,
  bccEmail?: string,
  subject?: string,
  afterStatus?: string,
  afterStatusColumnId?: string
) {
  try {
    // Make.com webhook URL for sending emails
    const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/73uyhomvvkryb7m8afjkusffh2o2qst1";

    // Fetch item and board data
    const itemRes = await supabaseFetch(`items?id=eq.${itemId}&select=id,name,board_id`);
    const [item] = await itemRes.json() as any[];
    if (!item) {
      await logAutomation(automationId, "error", `Item ${itemId} not found`);
      return;
    }

    const boardRes = await supabaseFetch(`boards?id=eq.${boardId}&select=id,name`);
    const [board] = await boardRes.json() as any[];
    const boardName = board?.name || "Unknown Board";

    // Fetch all cell values for this item
    const cellsRes = await supabaseFetch(`cell_values?item_id=eq.${itemId}&select=item_id,column_id,value`);
    const cells = await cellsRes.json() as any[];

    // Fetch all columns to get their names
    const columnsRes = await supabaseFetch(`columns?board_id=eq.${boardId}&select=id,name`);
    const columns = await columnsRes.json() as any[];
    const columnMap = new Map(columns.map((c: any) => [c.id, c.name]));

    // Build replacement map
    const replacements: Record<string, string> = {
      "{{item.name}}": item.name || "",
      "{{board.name}}": boardName,
    };

    // Add status value
    const statusCell = cells.find((c: any) => c.column_id === statusColumnId);
    if (statusCell) {
      let statusValueStr = "";
      if (statusCell.value && typeof statusCell.value === "object" && statusCell.value.label) {
        statusValueStr = String(statusCell.value.label);
      } else {
        statusValueStr = String(statusCell.value || "");
      }
      replacements["{{status.value}}"] = statusValueStr;
    }

    // Add all column values
    for (const cell of cells) {
      const columnName = columnMap.get(cell.column_id);
      if (columnName) {
        let cellValueStr = "";
        if (cell.value && typeof cell.value === "object") {
          if (cell.value.label) {
            cellValueStr = String(cell.value.label);
          } else if (cell.value.text) {
            cellValueStr = String(cell.value.text);
          } else {
            cellValueStr = JSON.stringify(cell.value);
          }
        } else {
          cellValueStr = String(cell.value || "");
        }

        // Add multiple variations of the column name for template matching
        const placeholderKey = columnName.toLowerCase().replace(/\s+/g, "_");
        const placeholderKeyNoHyphen = placeholderKey.replace(/-/g, "_");
        const placeholderKeyHyphen = columnName.toLowerCase().replace(/\s+/g, "-");
        const placeholderKeyNoHyphenNoUnderscore = placeholderKeyNoHyphen.replace(/_/g, "");
        
        replacements[`{{column.${columnName}}}`] = cellValueStr;
        replacements[`{{column.${columnName.toLowerCase()}}}`] = cellValueStr;
        replacements[`{{column.${placeholderKey}}}`] = cellValueStr;
        replacements[`{{column.${placeholderKeyNoHyphen}}}`] = cellValueStr;
        replacements[`{{column.${placeholderKeyHyphen}}}`] = cellValueStr;
        replacements[`{{column.${placeholderKeyNoHyphenNoUnderscore}}}`] = cellValueStr;
      }
    }

    // Replace placeholders in template
    let processedTemplate = template;
    for (const [key, value] of Object.entries(replacements)) {
      processedTemplate = processedTemplate.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), value);
    }

    // Convert URLs to clickable links
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;
    let lastIndex = 0;
    const parts: string[] = [];
    let match;

    while ((match = urlRegex.exec(processedTemplate)) !== null) {
      const url = match[0];
      const offset = match.index;
      parts.push(processedTemplate.substring(lastIndex, offset));

      const beforeUrl = processedTemplate.substring(0, offset);
      const afterUrl = processedTemplate.substring(offset + url.length);
      const lastOpenTag = beforeUrl.lastIndexOf('<a');
      const lastCloseTag = beforeUrl.lastIndexOf('</a>');
      const nextCloseTag = afterUrl.indexOf('</a>');

      if (lastOpenTag > lastCloseTag && nextCloseTag !== -1) {
        parts.push(url);
      } else {
        parts.push(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
      }
      lastIndex = offset + url.length;
    }
    parts.push(processedTemplate.substring(lastIndex));
    processedTemplate = parts.join('');

    // Helper function to resolve email addresses
    const resolveEmailField = (emailField?: string): string[] => {
      if (!emailField) return [];
      let processed = emailField;
      for (const [key, value] of Object.entries(replacements)) {
        processed = processed.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), value);
      }
      return processed.split(/[\s,]+/).filter(e => e.trim().length > 0);
    };

    // Resolve "to" email addresses
    let emailTo: string[] = [];
    if (toEmail) {
      emailTo = resolveEmailField(toEmail);
    } else {
      for (const cell of cells) {
        const columnName = columnMap.get(cell.column_id);
        if (columnName && columnName.toLowerCase().includes("email")) {
          const emailValue = String(cell.value || "");
          if (emailValue) {
            emailTo = [emailValue];
            break;
          }
        }
      }
    }

    if (emailTo.length === 0) {
      await logAutomation(automationId, "error", "No email address found");
      return;
    }

    // Resolve CC and BCC
    const emailCc = resolveEmailField(ccEmail);
    const emailBcc = resolveEmailField(bccEmail);

    // Resolve subject
    let emailSubject = "Task Update";
    if (subject) {
      emailSubject = subject;
      for (const [key, value] of Object.entries(replacements)) {
        emailSubject = emailSubject.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), value);
      }
    } else {
      const subjectMatch = processedTemplate.match(/^Subject:\s*(.+?)(?:\n\n|\n$)/i);
      if (subjectMatch) {
        emailSubject = subjectMatch[1].trim();
        processedTemplate = processedTemplate.replace(/^Subject:\s*.+?(?:\n\n|\n$)/i, "").trim();
      }
    }

    const body = processedTemplate;

    // Resolve "from" email address with template replacement
    let emailFrom = fromEmail || "noreply@artepay.com";
    if (fromEmail) {
      for (const [key, value] of Object.entries(replacements)) {
        emailFrom = emailFrom.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), value);
      }
    }
    // Ensure from is not empty
    if (!emailFrom || emailFrom.trim() === "") {
      emailFrom = "noreply@artepay.com";
    }

    // Ensure subject is not empty
    if (!emailSubject || emailSubject.trim() === "") {
      emailSubject = "Task Update";
    }

    // Prepare email payload for Make.com webhook
    const emailPayload: any = {
      from: emailFrom.trim(),
      to: emailTo,
      subject: emailSubject.trim(),
      html: body,
      text: body.replace(/<[^>]*>/g, ""),
    };

    if (emailCc.length > 0) emailPayload.cc = emailCc;
    if (emailBcc.length > 0) emailPayload.bcc = emailBcc;

    // Send to Make.com webhook
    const res = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailPayload),
    });

    const responseText = await res.text();
    let data: any = responseText;
    try {
      data = JSON.parse(responseText);
    } catch { }

    if (!res.ok) {
      const errorMsg = typeof data === 'object' && data.message ? data.message : `HTTP ${res.status}`;
      await logAutomation(automationId, "error", `Email webhook failed: ${errorMsg}`);
      return;
    }

    await logAutomation(automationId, "success", `Email sent to ${emailTo.join(', ')} via Make.com`);

    // Update status after successful email send
    if (afterStatus && afterStatusColumnId) {
      await supabaseFetch(`cell_values`, {
        method: "POST",
        body: JSON.stringify([{
          item_id: itemId,
          column_id: afterStatusColumnId,
          value: afterStatus
        }])
      });
      await logAutomation(automationId, "success", `Status updated to ${afterStatus}`);
    }
  } catch (e) {
    await logAutomation(automationId, "error", `Email failed: ${(e as Error).message}`);
  }
}


async function changeStatus(itemId: string, statusColumnId: string, statusValue: string) {
  try {
    // If status_value is empty, set to null (no status)
    const value = statusValue ? statusValue : null;

    // Check if cell value already exists
    const existingRes = await supabaseFetch(`cell_values?item_id=eq.${itemId}&column_id=eq.${statusColumnId}`);
    const existing = await existingRes.json() as any[];

    if (existing.length > 0) {
      // Update existing cell value
      await supabaseFetch(`cell_values?item_id=eq.${itemId}&column_id=eq.${statusColumnId}`, {
        method: "PATCH",
        body: JSON.stringify({ value })
      });
    } else {
      // Create new cell value
      await supabaseFetch(`cell_values`, {
        method: "POST",
        body: JSON.stringify([{
          item_id: itemId,
          column_id: statusColumnId,
          value
        }])
      });
    }
  } catch (e) {
    throw new Error(`Failed to change status: ${(e as Error).message}`);
  }
}

async function aiFillFields(
  automationId: string,
  itemId: string,
  boardId: string,
  aiInstructions: string,
  fieldMappings: Array<{ column_id: string; instruction: string }>
) {
  try {
    if (!OPENROUTER_API_KEY) {
      await logAutomation(automationId, "error", "OPENROUTER_API_KEY not configured");
      return;
    }

    // Fetch item data
    const itemRes = await supabaseFetch(`items?id=eq.${itemId}&select=id,name,board_id`);
    const [item] = await itemRes.json() as any[];
    if (!item) {
      await logAutomation(automationId, "error", `Item ${itemId} not found`);
      return;
    }

    // Fetch board data
    const boardRes = await supabaseFetch(`boards?id=eq.${boardId}&select=id,name`);
    const [board] = await boardRes.json() as any[];

    // Fetch all cell values for this item
    const cellsRes = await supabaseFetch(`cell_values?item_id=eq.${itemId}&select=item_id,column_id,value`);
    const cells = await cellsRes.json() as any[];

    // Fetch all columns to get their names and types
    const columnsRes = await supabaseFetch(`columns?board_id=eq.${boardId}&select=id,name,type`);
    const columns = await columnsRes.json() as any[];
    const columnMap = new Map(columns.map((c: any) => [c.id, c]));

    // Build context about the item
    const itemContext: Record<string, any> = {
      item_name: item.name,
      board_name: board?.name || "Unknown",
      fields: {}
    };

    for (const cell of cells) {
      const column = columnMap.get(cell.column_id);
      if (column) {
        let valueStr = "";
        if (cell.value && typeof cell.value === "object") {
          if (cell.value.label) {
            valueStr = String(cell.value.label);
          } else if (cell.value.text) {
            valueStr = String(cell.value.text);
          } else {
            valueStr = JSON.stringify(cell.value);
          }
        } else {
          valueStr = String(cell.value || "");
        }
        itemContext.fields[column.name] = valueStr;
      }
    }

    // Build field mapping instructions for the AI
    const fieldInstructions = fieldMappings
      .map((mapping) => {
        const column = columnMap.get(mapping.column_id);
        return column
          ? `- ${column.name} (${column.type}): ${mapping.instruction}`
          : null;
      })
      .filter(Boolean)
      .join("\n");

    // Build the AI prompt
    const prompt = `You are an AI assistant helping to fill fields in a task management board.

ITEM CONTEXT:
- Task Name: ${itemContext.item_name}
- Board: ${itemContext.board_name}
- Current Fields: ${JSON.stringify(itemContext.fields, null, 2)}

INSTRUCTIONS:
${aiInstructions}

FIELDS TO FILL:
${fieldInstructions}

Please respond with ONLY a JSON object where keys are field names and values are the content to put in each field. Do not include any markdown formatting or explanation, just the raw JSON.

Example response format:
{"field1": "value1", "field2": "value2"}`;

    console.log("[AI_FILL_FIELDS] Calling OpenRouter API...");
    console.log("[AI_FILL_FIELDS] Prompt:", prompt);

    // Call OpenRouter API
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": SUPABASE_URL,
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      await logAutomation(automationId, "error", `OpenRouter API error: ${errorText}`);
      return;
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "{}";

    console.log("[AI_FILL_FIELDS] AI Response:", aiContent);

    // Parse AI response
    let fieldValues: Record<string, string>;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = aiContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
                        aiContent.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1] : aiContent;
      fieldValues = JSON.parse(jsonStr.trim());
    } catch (e) {
      await logAutomation(automationId, "error", `Failed to parse AI response: ${(e as Error).message}`);
      return;
    }

    // Update the fields using the upsert function
    let updatedCount = 0;

    for (const mapping of fieldMappings) {
      const column = columnMap.get(mapping.column_id);
      if (!column) continue;

      const fieldValue = fieldValues[column.name];
      if (fieldValue === undefined) continue;

      // Format value based on column type
      let formattedValue: any;
      switch (column.type) {
        case "number":
          // Try to parse as number
          const numValue = parseFloat(fieldValue);
          formattedValue = isNaN(numValue) ? fieldValue : numValue;
          break;
        case "checkbox":
          // Convert to boolean
          formattedValue = fieldValue === true || fieldValue === "true" || fieldValue === "yes" || fieldValue === "1";
          break;
        case "money":
          // Try to extract number from money string
          const moneyMatch = String(fieldValue).match(/[\d,.]+/);
          const moneyValue = moneyMatch ? parseFloat(moneyMatch[0].replace(/,/g, "")) : 0;
          formattedValue = moneyValue;
          break;
        default:
          // For text, long_text, email, date, status - store as string
          formattedValue = String(fieldValue);
      }

      console.log(`[AI_FILL_FIELDS] Updating field ${column.name} (type: ${column.type}) with value:`, formattedValue);

      // Check if cell already exists
      const checkRes = await supabaseFetch(`cell_values?item_id=eq.${itemId}&column_id=eq.${mapping.column_id}&select=*`);
      const existing = await checkRes.json() as any[];

      let upsertRes: Response;

      if (existing && existing.length > 0) {
        // Update existing cell
        console.log(`[AI_FILL_FIELDS] Updating existing cell for ${column.name}`);
        upsertRes = await supabaseFetch(
          `cell_values?item_id=eq.${itemId}&column_id=eq.${mapping.column_id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ value: formattedValue }),
          }
        );
      } else {
        // Insert new cell
        console.log(`[AI_FILL_FIELDS] Inserting new cell for ${column.name}`);
        upsertRes = await supabaseFetch(`cell_values`, {
          method: "POST",
          body: JSON.stringify([{
            item_id: itemId,
            column_id: mapping.column_id,
            value: formattedValue,
          }]),
        });
      }

      if (!upsertRes.ok) {
        const errorText = await upsertRes.text();
        console.error(`[AI_FILL_FIELDS] Error upserting field ${column.name}:`, errorText);
        await logAutomation(automationId, "error", `Failed to update ${column.name}: ${errorText}`);
      } else {
        updatedCount++;
        const resultText = await upsertRes.text();
        console.log(`[AI_FILL_FIELDS] Successfully updated field ${column.name}, response:`, resultText);
      }
    }

    await logAutomation(
      automationId,
      "success",
      `AI filled ${updatedCount} of ${fieldMappings.length} field(s)`
    );
  } catch (e) {
    await logAutomation(
      automationId,
      "error",
      `AI fill fields failed: ${(e as Error).message}`
    );
  }
}

// Helper function to build replacements map from item data
async function buildReplacements(itemId: string, boardId: string, statusColumnId?: string): Promise<Record<string, string>> {
  // Fetch item and board data
  const itemRes = await supabaseFetch(`items?id=eq.${itemId}&select=id,name,board_id`);
  const [item] = await itemRes.json() as any[];
  if (!item) {
    return {};
  }

  const boardRes = await supabaseFetch(`boards?id=eq.${boardId}&select=id,name`);
  const [board] = await boardRes.json() as any[];
  const boardName = board?.name || "Unknown Board";

  // Fetch all cell values for this item
  const cellsRes = await supabaseFetch(`cell_values?item_id=eq.${itemId}&select=item_id,column_id,value`);
  const cells = await cellsRes.json() as any[];

  // Fetch all columns to get their names
  const columnsRes = await supabaseFetch(`columns?board_id=eq.${boardId}&select=id,name`);
  const columns = await columnsRes.json() as any[];
  const columnMap = new Map(columns.map((c: any) => [c.id, c.name]));

  // Build replacement map
  const replacements: Record<string, string> = {
    "{{item.name}}": item.name || "",
    "{{board.name}}": boardName,
  };

  // Add status value if statusColumnId is provided
  if (statusColumnId) {
    const statusCell = cells.find((c: any) => c.column_id === statusColumnId);
    if (statusCell) {
      let statusValueStr = "";
      if (statusCell.value && typeof statusCell.value === "object" && statusCell.value.label) {
        statusValueStr = String(statusCell.value.label);
      } else {
        statusValueStr = String(statusCell.value || "");
      }
      replacements["{{status.value}}"] = statusValueStr;
    }
  }

  // Add all column values
  for (const cell of cells) {
    const columnName = columnMap.get(cell.column_id);
    if (columnName) {
      let cellValueStr = "";
      if (cell.value && typeof cell.value === "object") {
        if (cell.value.label) {
          cellValueStr = String(cell.value.label);
        } else if (cell.value.text) {
          cellValueStr = String(cell.value.text);
        } else {
          cellValueStr = JSON.stringify(cell.value);
        }
      } else {
        cellValueStr = String(cell.value || "");
      }

      // Add multiple variations of the column name for template matching
      const placeholderKey = columnName.toLowerCase().replace(/\s+/g, "_");
      const placeholderKeyNoHyphen = placeholderKey.replace(/-/g, "_");
      const placeholderKeyHyphen = columnName.toLowerCase().replace(/\s+/g, "-");
      const placeholderKeyNoHyphenNoUnderscore = placeholderKeyNoHyphen.replace(/_/g, "");
      
      replacements[`{{column.${columnName}}}`] = cellValueStr;
      replacements[`{{column.${columnName.toLowerCase()}}}`] = cellValueStr;
      replacements[`{{column.${placeholderKey}}}`] = cellValueStr;
      replacements[`{{column.${placeholderKeyNoHyphen}}}`] = cellValueStr;
      replacements[`{{column.${placeholderKeyHyphen}}}`] = cellValueStr;
      replacements[`{{column.${placeholderKeyNoHyphenNoUnderscore}}}`] = cellValueStr;
    }
  }

  return replacements;
}

// Recursively replace template variables in any value
function replaceTemplateVariables(value: unknown, replacements: Record<string, string>): unknown {
  if (typeof value === "string") {
    let processed = value;
    for (const [key, replacement] of Object.entries(replacements)) {
      processed = processed.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), replacement);
    }
    return processed;
  } else if (Array.isArray(value)) {
    return value.map((item) => replaceTemplateVariables(item, replacements));
  } else if (value && typeof value === "object") {
    const processed: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      processed[key] = replaceTemplateVariables(val, replacements);
    }
    return processed;
  }
  return value;
}

async function callWebhook(automationId: string, url: string, payload: unknown, itemId?: string, boardId?: string, columnId?: string) {
  try {
    let processedPayload = payload;
    
    // If we have itemId and boardId, process template variables
    if (itemId && boardId) {
      const replacements = await buildReplacements(itemId, boardId, columnId);
      processedPayload = replaceTemplateVariables(payload, replacements);
    }
    
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(processedPayload)
    });
    await logAutomation(automationId, res.ok ? "success" : "error", `Webhook ${res.status}`);
  } catch (e) {
    await logAutomation(automationId, "error", `Webhook failed: ${(e as Error).message}`);
  }
}

async function logAutomation(automationId: string, status: string, message: string) {
  await supabaseFetch(`automation_logs`, {
    method: "POST",
    body: JSON.stringify([{ automation_id: automationId, status, message }])
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    // expected body: { board_id?: string }
    const body = await req.json().catch(() => ({}));
    const boardId = body?.board_id as string | undefined;
    console.log(`Automation function called with board_id: ${boardId}`);
    
    // fetch unprocessed events (limit batch)
    const evPath = boardId
      ? `automation_events?processed_at=is.null&board_id=eq.${boardId}&select=id,board_id,item_id,column_id,old_value,new_value&order=created_at.asc&limit=100`
      : `automation_events?processed_at=is.null&select=id,board_id,item_id,column_id,old_value,new_value&order=created_at.asc&limit=100`;
    console.log(`Fetching events from: ${evPath}`);
    const evRes = await supabaseFetch(evPath);
    
    if (!evRes.ok) {
      const errorText = await evRes.text();
      console.error(`Failed to fetch events: ${evRes.status} ${errorText}`);
      return new Response(JSON.stringify({ error: `Failed to fetch events: ${evRes.status}` }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const events = await evRes.json() as EventRow[];
    console.log(`Found ${events.length} unprocessed events`);
    
    if (!events.length) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { "Content-Type": "application/json" } });
    }
    
    // load automations for involved boards
    const boardIds = Array.from(new Set(events.map((e) => e.board_id)));
    console.log(`Loading automations for boards: ${boardIds.join(", ")}`);
    
    // Fix: Use proper PostgREST syntax for IN query
    const autoPath = boardIds.length === 1
      ? `automations?is_active=eq.true&board_id=eq.${boardIds[0]}&select=*`
      : `automations?is_active=eq.true&board_id=in.(${boardIds.join(",")})&select=*`;
    
    const autoRes = await supabaseFetch(autoPath);
    
    if (!autoRes.ok) {
      const errorText = await autoRes.text();
      console.error(`Failed to fetch automations: ${autoRes.status} ${errorText}`);
      return new Response(JSON.stringify({ error: `Failed to fetch automations: ${autoRes.status}` }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const automations = await autoRes.json() as Automation[];
    console.log(`Found ${automations.length} active automations`);
    
    // process STATUS_CHANGED only (MVP)
    await processStatusChanged(events, automations);
    
    // mark processed
    const now = new Date().toISOString();
    await Promise.all(
      events.map((e) =>
        supabaseFetch(`automation_events?id=eq.${e.id}`, {
          method: "PATCH",
          body: JSON.stringify({ processed_at: now })
        })
      )
    );
    
    return new Response(JSON.stringify({ processed: events.length }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Automation function error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});


