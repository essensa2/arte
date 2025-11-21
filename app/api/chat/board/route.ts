import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const MODEL = "qwen/qwen-2.5-vl-7b-instruct";

interface ChatMessage {
  role: "user" | "assistant";
  content: string | { type: "text"; text: string }[] | { type: "image_url"; image_url: { url: string } };
}

interface ChatRequest {
  messages: ChatMessage[];
  boardId: string;
  addData?: { itemName: string; cellValues: Record<string, any> } | { items: Array<{ itemName: string; cellValues: Record<string, any> }> };
  updateData?: { updates: Array<{ itemName: string; cellValues: Record<string, any> }> }; // For updating existing items
  imageContent?: string; // From client drag-drop
}

// Helper function to fix truncated JSON by closing unclosed brackets/braces
function fixTruncatedJson(jsonStr: string): string {
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let lastValidPos = jsonStr.length;

  // Count unclosed braces and brackets
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    const prevChar = i > 0 ? jsonStr[i - 1] : '';

    // Track if we're inside a string
    if (char === '"' && prevChar !== '\\') {
      inString = !inString;
    }

    if (!inString) {
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }
  }

  // Find the last complete item in items array if JSON is truncated
  if (openBraces > 0 || openBrackets > 0) {
    // Try to find the last complete item
    const itemsMatch = jsonStr.match(/"items"\s*:\s*\[/);
    if (itemsMatch) {
      const itemsStart = itemsMatch.index! + itemsMatch[0].length;
      let itemsBracketCount = 0;
      let lastCompleteItemEnd = itemsStart;
      let inItemString = false;

      for (let i = itemsStart; i < jsonStr.length; i++) {
        const char = jsonStr[i];
        const prevChar = i > 0 ? jsonStr[i - 1] : '';

        // Track if we're inside a string
        if (char === '"' && prevChar !== '\\') {
          inItemString = !inItemString;
        }

        if (!inItemString) {
          if (char === '{') itemsBracketCount++;
          if (char === '}') {
            itemsBracketCount--;
            if (itemsBracketCount === 0) {
              // Found a complete item
              lastCompleteItemEnd = i + 1;
            }
          }
        }
      }

      // Truncate to last complete item and close the JSON
      if (lastCompleteItemEnd > itemsStart) {
        let result = jsonStr.substring(0, lastCompleteItemEnd);
        // Close the items array and the main object
        result += '\n  ]\n}';
        return result;
      }
    }
  }

  // If no special handling needed, just close unclosed brackets
  let result = jsonStr;
  for (let i = 0; i < openBrackets; i++) {
    result += ']';
  }
  for (let i = 0; i < openBraces; i++) {
    result += '}';
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== Chat API called ===");
    const body = await request.json();
    console.log("Body parsed successfully");
    const { messages = [], boardId, addData, updateData, imageContent }: ChatRequest = body;
    console.log("Request params:", { boardId, hasMessages: messages.length > 0, hasAddData: !!addData });

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY missing" }, { status: 500 });
    }

    const supabase = createServerSupabase();

    // Safe board data read
    let columns: any[] = [];
    let items: any[] = [];
    try {
      const colsRes = await supabase.from("columns").select("*").eq("board_id", boardId).order("position");
      const itsRes = await supabase.from("items").select("id,name").eq("board_id", boardId).limit(5).order("position");
      columns = colsRes.data || [];
      items = itsRes.data || [];
    } catch (dbError) {
      console.error("DB read error:", dbError);
    }

    // Build detailed column mapping for AI
    const columnMapping = columns.map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type
    }));
    const columnInfo = columnMapping.length > 0 
      ? columnMapping.map((c: any) => `- Veerg "${c.name}" (tüüp: ${c.type}, ID: ${c.id})`).join("\n")
      : "Pole veerge";
    const sampleItems = items.map((i: any) => i.name).join(", ") || "Pole üksusi";

    // Check if any message contains an image
    const hasImage = messages.some((msg: ChatMessage) => 
      typeof msg.content !== "string" && 
      Array.isArray(msg.content) && 
      msg.content.some((part: any) => part.type === "image_url")
    );
    const lastMessage = messages[messages.length - 1];
    const lastMessageHasImage = lastMessage && typeof lastMessage.content !== "string" && 
                                Array.isArray(lastMessage.content) && 
                                lastMessage.content.some((part: any) => part.type === "image_url");

    // Build example JSON with actual column IDs
    const exampleCellValues = columnMapping.slice(0, 3).reduce((acc: any, col: any, idx: number) => {
      const exampleValues: Record<string, string> = {
        text: `"Näidis väärtus ${idx + 1}"`,
        email: `"näide@email.com"`,
        phone: `"+372 1234567"`,
        number: `"100"`,
        money: `"50.00"`,
        status: `"Töös"`,
        date: `"2024-01-15"`
      };
      acc[col.id] = exampleValues[col.type] || `"Näidis väärtus"`;
      return acc;
    }, {} as Record<string, string>);

    const exampleJson = columnMapping.length > 0 ? `
Näide JSON-ist (kasuta TEGELIKKE veeru ID-sid):
{
  "action": "add_item",
  "itemName": "Ekstraheeritud nimi",
  "cellValues": {
${Object.entries(exampleCellValues).map(([id, val]) => `    "${id}": ${val}`).join(",\n")}
  }
}` : "";

    // Find specific columns that might be referenced
    const column2025OKT = columnMapping.find((c: any) => c.name.toLowerCase().includes('2025okt') || c.name.toLowerCase().includes('2025'));
    const nameColumn = columnMapping.find((c: any) => c.name.toLowerCase().includes('nimi') || c.name.toLowerCase().includes('name') || c.type === 'text');
    
    const systemPrompt = `Sa oled ArtePay Board AI assistent. ALATI vasta eesti keeles.

═══════════════════════════════════════════════════════════════
OLULINE: EKRAANIPILTIDE TÖÖTLEMINE
═══════════════════════════════════════════════════════════════

Kui kasutaja saadab ekraanipildi või pildi, on see SINU PEAMINE ÜLESANNE:
1. Hoolikalt analüüsida KOGU pildi sisu
2. Eraldada KÕIK andmed, mis sobivad tabeli veergudega
3. ALATI tagastada JSON-vormingus suggestedAction
4. MITTE lihtsalt kirjeldada, mida näed - PEA tegutsema!

═══════════════════════════════════════════════════════════════
TABELI STRUKTUUR
═══════════════════════════════════════════════════════════════

Tabeli veerud (kasuta neid ID-sid cellValues-is):
${columnInfo}
${column2025OKT ? `\n⚠️ OLULINE: Veerg "${column2025OKT.name}" (ID: ${column2025OKT.id}) - kasuta seda numbrite, summade ja väärtuste jaoks!` : ''}

Olemasolevad üksused tabelis:
${items.length > 0 ? items.map((i: any) => `- "${i.name}"`).join("\n") : "Pole üksusi"}

═══════════════════════════════════════════════════════════════
EKRAANIPILT LISTIGA (nt. nimed + numbrid, kontaktid, arved)
═══════════════════════════════════════════════════════════════

Kui pildil on LIST või TABEL (nt. liikmete nimekiri koos numbritega):
- Analüüsi pilti TÄIELIKULT - loe KÕIK read
- Eralda KÕIK read/listi elemendid - ÄRA jäta ühtegi vahele
- Iga rida sisaldab: NIMI + VÄÄRTUS (number, summa jne)
- ⚠️ KRIITILINE: Kui näed LISTI (nt. "Member 20250KT" koos nimedega ja numbritega):
  * See tähendab, et pead UUENDAMA olemasolevaid üksusi, MITTE looma uusi!
  * Otsi iga nime järgi tabelist - kui nimi on juba olemas, UUENDA seda
  * Lisa väärtus (number) veergu "${column2025OKT?.name || '2025OKT'}" (ID: ${column2025OKT?.id || 'column-id'})
  * ÄRA loo duplikaate - kui nimi on juba tabelis, UUENDA seda!
- ⚠️ OLULINE: ÄRA näita JSON-i kasutajale! Vasta lihtsalt eesti keeles: "Leidsin pildilt [X] üksust. Uuendan olemasolevaid üksusi nende väärtustega."
- Tagasta JSON-vormingus suggestedAction (PEIDETUD - kasutaja ei näe seda):

OLULINE: 
- KASUTA ALATI "action": "update_or_add_items" (mitte "add_items")
- itemName on NIMI, mida otsitakse tabelist (case-insensitive)
- Kui nimi leitakse tabelist → UUENDA selle üksuse cellValues (ÄRA loo uut!)
- Kui nime pole tabelis → LOO uus üksus selle nimega
- Numbrid/väärtused lähevad veergu "${column2025OKT?.name || '2025OKT'}" (ID: ${column2025OKT?.id || 'column-id'})

═══════════════════════════════════════════════════════════════
EKRAANIPILT ÜHE ÜKSUSEGA (nt. kontaktikaart, arve, dokument)
═══════════════════════════════════════════════════════════════

Kui pildil on ÜKS üksus:
- Analüüsi pilti täielikult
- Eralda KÕIK andmed (nimi, telefon, e-post, aadress, staatus, kuupäev, summa, number, ID jne)
- Vasta eesti keeles, mis andmed leidsid (ÄRA näita JSON-i!)
- Tagasta JSON-vormingus suggestedAction (PEIDETUD - kasutaja ei näe seda)

═══════════════════════════════════════════════════════════════
KRIITILISED REEGLID
═══════════════════════════════════════════════════════════════

1. EKRAANIPILT = KOHUSTUSLIK JSON TAGASTAMINE (KRIITILINE!)
   - Kui näed pilti, PEAD sa tagastama JSON-i - see on SINU PEAMINE ÜLESANNE
   - ÄRA lihtsalt kirjelda - TAGASTA JSON kohe
   - ⚠️ ÄRA näita JSON-i kasutajale! Vasta ainult lihtsa eesti keelse sõnumiga
   - Isegi kui andmed on osaliselt ebaselged, proovi neid eraldada
   - Kui ei leia andmeid, tagasta tühi items array, aga ALATI tagasta JSON
   - ÄRA kunagi jäta JSON-i tagastamata, kui pilt on saadetud
   - JSON peab olema tagastatud, aga ÄRA näita seda kasutajale - ainult lihtne eesti keelne vastus!

2. LISTIDE TÖÖTLEMINE (UUENDAMINE, MITTE LISAMINE!)
   - Kui pildil on LIST, eralda KÕIK read
   - ÄRA jäta ühtegi rida vahele
   - KONTROLLI, kas nimed on juba tabelis
   - Kasuta "action": "update_or_add_items" ja "items": [array]
   - Kui nimi on juba tabelis → UUENDA seda (ÄRA loo duplikaati!)
   - Kui nime pole → LOO uus üksus

3. ÜKSIKUTE ÜKSUSTE TÖÖTLEMINE
   - Kasuta "action": "add_item" ja "itemName": "..."

4. VEERU ID-D
   - cellValues peab sisaldama TEGELIKKE veeru ID-sid (mitte veeru nimesid)
   - Kasuta ülaltoodud veergude ID-sid täpselt nagu need on
   - Kui leiad andmeid, mis sobivad veergudega, LISA need alati JSON-i

5. ANDMETE SOBITAMINE
   - Numbrid → veergud tüübiga "number", "money" või veerg nimega "2025OKT", "Summa" jne
   - Nimed → veergud tüübiga "text" või veerg nimega "Nimi", "Nimi/Pealkiri" jne
   - Telefonid → veergud tüübiga "phone" või veerg nimega "Telefon" jne
   - E-postid → veergud tüübiga "email" või veerg nimega "E-post" jne
   - Kuupäevad → veergud tüübiga "date" või veerg nimega "Kuupäev" jne

6. JSON FORMAAT
   - JSON peab olema kehtiv
   - Peab sisaldama vähemalt itemName/itemName ja cellValues
   - cellValues peab sisaldama veeru ID-sid, mitte nimesid

═══════════════════════════════════════════════════════════════
KUI POLE EKRAANIPILTI
═══════════════════════════════════════════════════════════════

Vasta tavaliselt eesti keeles ja aita kasutajal.`;

    // Add welcome message if this is the first user message
    const isFirstMessage = messages.length === 0 || (messages.length === 1 && messages[0].role === "user");
    const welcomeMessage = isFirstMessage ? [
      { role: "assistant" as const, content: "Tere! Olen ArtePay Board AI assistent. Kuidas saan sind aidata? Võin aidata lisada üksusi tabelisse või analüüsida ekraanipilte." }
    ] : [];

    // Add reinforcement message if image is detected
    const imageReminder = lastMessageHasImage ? [
      { 
        role: "user" as const, 
        content: [{ 
          type: "text" as const, 
          text: "OLULINE: Analüüsi seda ekraanipilti hoolikalt ja eralda KÕIK andmed, mis sobivad tabeli veergudega. Tagasta JSON-vormingus suggestedAction kohe pärast analüüsi." 
        }] 
      }
    ] : [];

    const formattedMessages = [
      { role: "system", content: [{ type: "text", text: systemPrompt }] },
      ...welcomeMessage,
      ...messages.map((msg: ChatMessage) => ({
        role: msg.role,
        content: typeof msg.content === "string" ? [{ type: "text", text: msg.content }] : msg.content,
      })),
      ...imageReminder,
    ];

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "ArtePay Board AI",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: formattedMessages,
        temperature: hasImage ? 0.0 : 0.1, // Lower temperature for more consistent extraction
        max_tokens: hasImage ? 2000 : 600, // More tokens for image analysis and lists
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || "OpenRouter error" }, { status: 500 });
    }

    const data = await res.json();
    const assistantContent = data.choices[0]?.message?.content || "No response";

    // Log for debugging
    if (hasImage) {
      console.log("Image analysis response:", assistantContent.substring(0, 500));
      console.log("Columns available:", columnMapping.map((c: any) => `${c.name} (${c.id})`).join(", "));
    }

    let suggestedAction = null;
    
    // Enhanced JSON extraction - try multiple strategies
    if (hasImage) {
      // Strategy 1: Look for JSON in code blocks (most reliable)
      // Use non-greedy match but ensure we capture the complete JSON
      const codeBlockMatch = assistantContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (codeBlockMatch) {
        try {
          // Extract the JSON string and trim it
          const jsonStr = codeBlockMatch[1].trim();
          const parsed = JSON.parse(jsonStr);
          if (parsed.action === "add_item" && parsed.itemName && parsed.cellValues) {
            suggestedAction = parsed;
          } else if ((parsed.action === "add_items" || parsed.action === "update_or_add_items") && Array.isArray(parsed.items) && parsed.items.length > 0) {
            suggestedAction = parsed;
          }
        } catch (e) {
          console.log("Failed to parse JSON from code block:", e);
          // Try to extract a valid subset if the JSON is truncated
          try {
            const jsonStr = codeBlockMatch[1].trim();
            // If JSON is truncated, try to close it properly
            const fixedJson = fixTruncatedJson(jsonStr);
            const parsed = JSON.parse(fixedJson);
            if ((parsed.action === "add_items" || parsed.action === "update_or_add_items") && Array.isArray(parsed.items) && parsed.items.length > 0) {
              suggestedAction = parsed;
              console.log(`Successfully recovered ${parsed.items.length} items from truncated JSON`);
            }
          } catch (e2) {
            console.log("Failed to recover from truncated JSON:", e2);
          }
        }
      }
      
      // Strategy 2: Look for complete JSON objects with action field
      if (!suggestedAction) {
        const jsonMatch = assistantContent.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.action === "add_item" && parsed.itemName && parsed.cellValues) {
              suggestedAction = parsed;
            } else if ((parsed.action === "add_items" || parsed.action === "update_or_add_items") && Array.isArray(parsed.items) && parsed.items.length > 0) {
              suggestedAction = parsed;
            }
          } catch (e) {
            console.log("Failed to parse JSON from match:", e);
            // Try to fix truncated JSON
            try {
              const fixedJson = fixTruncatedJson(jsonMatch[0]);
              const parsed = JSON.parse(fixedJson);
              if ((parsed.action === "add_items" || parsed.action === "update_or_add_items") && Array.isArray(parsed.items) && parsed.items.length > 0) {
                suggestedAction = parsed;
                console.log(`Recovered ${parsed.items.length} items from truncated JSON (strategy 2)`);
              }
            } catch (e2) {
              console.log("Failed to recover from truncated JSON (strategy 2):", e2);
            }
          }
        }
      }
      
      // Strategy 3: Look for any JSON-like structure with items array
      if (!suggestedAction) {
        const itemsArrayMatch = assistantContent.match(/\{[\s\S]*?"items"[\s\S]*?\[[\s\S]*?\]/);
        if (itemsArrayMatch) {
          try {
            // Try to find the closing brace
            let braceCount = 0;
            let jsonEnd = itemsArrayMatch[0].length;
            for (let i = 0; i < itemsArrayMatch[0].length; i++) {
              if (itemsArrayMatch[0][i] === '{') braceCount++;
              if (itemsArrayMatch[0][i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  jsonEnd = i + 1;
                  break;
                }
              }
            }
            const fullJson = itemsArrayMatch[0].substring(0, jsonEnd);
            const parsed = JSON.parse(fullJson);
            if ((parsed.action === "add_items" || parsed.action === "update_or_add_items") && Array.isArray(parsed.items) && parsed.items.length > 0) {
              suggestedAction = parsed;
            }
          } catch (e) {
            console.log("Failed to parse items array JSON:", e);
            // Try to fix truncated JSON
            try {
              const fixedJson = fixTruncatedJson(itemsArrayMatch[0]);
              const parsed = JSON.parse(fixedJson);
              if ((parsed.action === "add_items" || parsed.action === "update_or_add_items") && Array.isArray(parsed.items) && parsed.items.length > 0) {
                suggestedAction = parsed;
                console.log(`Recovered ${parsed.items.length} items from truncated JSON (strategy 3)`);
              }
            } catch (e2) {
              console.log("Failed to recover from truncated JSON (strategy 3):", e2);
            }
          }
        }
      }
      
      // Strategy 4: If still no action and we have image, log warning
      if (!suggestedAction) {
        console.warn("⚠️ Image detected but no suggestedAction extracted. Response:", assistantContent.substring(0, 300));
      }
    } else {
      // For non-image messages, use simpler extraction
      const jsonMatch = assistantContent.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.action === "add_item" && parsed.itemName && parsed.cellValues) {
            suggestedAction = parsed;
          }
        } catch {}
      }
    }

    // Remove JSON code blocks and JSON objects from the displayed message
    // Keep only the Estonian text response
    let displayContent = assistantContent;
    
    try {
      // Remove JSON code blocks
      displayContent = displayContent.replace(/```json[\s\S]*?```/g, '');
      displayContent = displayContent.replace(/```[\s\S]*?\{[\s\S]*?\}[\s\S]*?```/g, '');
      
      // Remove lines that look like JSON (contain "action", "itemName", "cellValues", etc.)
      const lines = displayContent.split('\n');
      const filteredLines = lines.filter(line => {
        const trimmed = line.trim();
        // Skip lines that are clearly JSON
        if (trimmed.startsWith('{') || trimmed.startsWith('}') || 
            trimmed.includes('"action"') || trimmed.includes('"itemName"') || 
            trimmed.includes('"cellValues"') || trimmed.includes('"items"')) {
          return false;
        }
        return true;
      });
      displayContent = filteredLines.join('\n');
      
      // Clean up extra whitespace and newlines
      displayContent = displayContent.replace(/\n{3,}/g, '\n\n').trim();
    } catch (e) {
      // If filtering fails, just use the original content
      console.error("Error filtering JSON from display:", e);
      displayContent = assistantContent;
    }
    
    // If content is empty after removing JSON, use a default message
    if (!displayContent || displayContent.length < 10) {
      if (suggestedAction && typeof suggestedAction === 'object' && 'action' in suggestedAction) {
        const action = suggestedAction as any;
        if (action.action === 'update_or_add_items' && Array.isArray(action.items)) {
          displayContent = `Leidsin pildilt ${action.items.length} üksust. Uuendan olemasolevaid üksusi nende väärtustega.`;
        } else if (action.action === 'add_items' && Array.isArray(action.items)) {
          displayContent = `Leidsin pildilt ${action.items.length} üksust. Lisan need tabelisse.`;
        } else if (action.action === 'add_item' && action.itemName) {
          displayContent = `Leidsin üksuse "${action.itemName}". Lisan selle tabelisse.`;
        } else {
          displayContent = "Analüüsisin pildi ja eraldasin andmed. Uuendan tabelit.";
        }
      } else {
        displayContent = "Analüüsisin pildi. Kui leidsin andmeid, näed neid tabelis.";
      }
    }
    
    const assistantMsg = { role: "assistant", content: displayContent, suggestedAction };

    let addedItemId = null;
    let addedItemIds: string[] = [];
    let updatedItemIds: string[] = [];
    
    // Handle update_or_add_items - find existing items by name and update them
    if (addData && 'items' in addData && Array.isArray(addData.items) && addData.items.length > 0) {
      const actionType = (addData as any).action || 'add_items';
      
      if (actionType === 'update_or_add_items') {
        try {
          // Get all existing items for name matching
          const { data: allItems } = await supabase
            .from("items")
            .select("id, name")
            .eq("board_id", boardId);
          
          const itemsMap = new Map<string, string>(); // name -> item_id
          (allItems || []).forEach((item: any) => {
            itemsMap.set(item.name.toLowerCase().trim(), item.id);
          });
          
          // Process each item: update if exists, create if not
          for (const itemData of addData.items) {
            const itemName = itemData.itemName?.trim();
            if (!itemName) continue;
            
            const existingItemId = itemsMap.get(itemName.toLowerCase());
            
            if (existingItemId) {
              // UPDATE existing item
              for (const [colId, value] of Object.entries(itemData.cellValues || {})) {
                let cellValue: any;
                if (typeof value === "string") {
                  cellValue = { text: value };
                } else if (typeof value === "object" && value !== null) {
                  cellValue = value;
                } else {
                  cellValue = { text: String(value) };
                }
                
                await supabase.from("cell_values").upsert({
                  item_id: existingItemId,
                  column_id: colId,
                  value: cellValue,
                });
              }
              updatedItemIds.push(existingItemId);
            } else {
              // CREATE new item
              const { data: lastItem } = await supabase
                .from("items")
                .select("position")
                .eq("board_id", boardId)
                .order("position", { ascending: false })
                .limit(1)
                .single();

              const nextPos = (lastItem?.position || 0) + 1;

              const { data: newItem } = await supabase
                .from("items")
                .insert({ board_id: boardId, name: itemName, position: nextPos })
                .select("id")
                .single();

              if (newItem) {
                addedItemIds.push(newItem.id);
                
                for (const [colId, value] of Object.entries(itemData.cellValues || {})) {
                  let cellValue: any;
                  if (typeof value === "string") {
                    cellValue = { text: value };
                  } else if (typeof value === "object" && value !== null) {
                    cellValue = value;
                  } else {
                    cellValue = { text: String(value) };
                  }
                  
                  await supabase.from("cell_values").upsert({
                    item_id: newItem.id,
                    column_id: colId,
                    value: cellValue,
                  });
                }
              }
            }
          }
        } catch (dbError) {
          console.error("Update or add items error:", dbError);
        }
      } else {
        // Original add_items logic (create new items only)
        const { data: lastItem } = await supabase
          .from("items")
          .select("position")
          .eq("board_id", boardId)
          .order("position", { ascending: false })
          .limit(1)
          .single();

        let nextPos = (lastItem?.position || 0) + 1;
        
        const itemsToInsert = addData.items.map((item: any) => ({
          board_id: boardId,
          name: item.itemName,
          position: nextPos++
        }));

        const { data: newItems, error: insertError } = await supabase
          .from("items")
          .insert(itemsToInsert)
          .select("id");

        if (newItems && newItems.length > 0) {
          addedItemIds = newItems.map((item: any) => item.id);
          
          for (let i = 0; i < newItems.length; i++) {
            const item = addData.items[i];
            const itemId = newItems[i].id;
            
            for (const [colId, value] of Object.entries(item.cellValues || {})) {
              let cellValue: any;
              if (typeof value === "string") {
                cellValue = { text: value };
              } else if (typeof value === "object" && value !== null) {
                cellValue = value;
              } else {
                cellValue = { text: String(value) };
              }
              
              await supabase.from("cell_values").upsert({
                item_id: itemId,
                column_id: colId,
                value: cellValue,
              });
            }
          }
        }
      }
    }
    
    // Handle single item add (not in items array)
    if (addData && boardId && !('items' in addData) && 'itemName' in addData) {
      try {
          // Single item
          const { data: lastItem } = await supabase
            .from("items")
            .select("position")
            .eq("board_id", boardId)
            .order("position", { ascending: false })
            .limit(1)
            .single();

          const nextPos = (lastItem?.position || 0) + 1;

          const { data: newItem } = await supabase
            .from("items")
            .insert({ board_id: boardId, name: addData.itemName, position: nextPos })
            .select("id")
            .single();

          if (newItem) {
            addedItemId = newItem.id;
            addedItemIds = [newItem.id];
            
            for (const [colId, value] of Object.entries(addData.cellValues || {})) {
              let cellValue: any;
              if (typeof value === "string") {
                cellValue = { text: value };
              } else if (typeof value === "object" && value !== null) {
                cellValue = value;
              } else {
                cellValue = { text: String(value) };
              }
              
              await supabase.from("cell_values").upsert({
                item_id: newItem.id,
                column_id: colId,
                value: cellValue,
              });
            }
          }
      } catch (dbError) {
        console.error("Add item error:", dbError);
      }
    }

    // Include welcome message in response if it's the first interaction
    const responseMessages = isFirstMessage 
      ? [...welcomeMessage, ...messages, assistantMsg]
      : [...messages, assistantMsg];

    return NextResponse.json({
      messages: responseMessages,
      suggestedAction,
      addedItemId,
      addedItemIds: addedItemIds.length > 0 ? addedItemIds : (addedItemId ? [addedItemId] : []),
      updatedItemIds: updatedItemIds.length > 0 ? updatedItemIds : [],
    });
  } catch (error) {
    console.error("=== Chat API error ===");
    console.error("Error:", error);
    console.error("Error message:", (error as Error).message);
    console.error("Error stack:", (error as Error).stack);
    return NextResponse.json({
      error: (error as Error).message,
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    }, { status: 500 });
  }
}
