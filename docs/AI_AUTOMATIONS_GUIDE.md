# AI Automation Guide

## Overview

You can now use AI to automatically fill fields on your board when a status changes! The AI will analyze the item's data and generate appropriate content for specified fields based on your instructions.

## How It Works

1. **Trigger**: When a status changes (e.g., when status becomes "Working on it")
2. **AI Analysis**: The AI reads all the item's data including name, board, and all field values
3. **AI Generation**: Based on your instructions, the AI generates content for specific fields
4. **Auto-Fill**: The generated content is automatically written to the specified fields

## Setting Up an AI Automation

### Step 1: Create a New Automation

1. Go to your board
2. Click "Automations" in the top menu
3. Click "Create automation" or scroll to the bottom

### Step 2: Configure the Trigger

Set up when the automation should run:
- **Column**: Select the status column to watch (e.g., "Status")
- **Target Status**: Choose which status triggers the automation (e.g., "Working on it")

### Step 3: Add AI Action

1. Click "Add action" or use the default action
2. Select **"Use AI to fill fields"** (🤖 icon)
3. Configure the AI:

   **AI Instructions** (required):
   - Describe what the AI should do overall
   - Example: "Analyze the customer request and generate a professional response"
   - Example: "Based on the project description, estimate complexity and suggest next steps"

   **Field Mappings** (required):
   - For each field you want the AI to fill:
     - Select the target field from the dropdown
     - Provide specific instructions for that field
   - You can add multiple fields

### Step 4: Save and Activate

1. Give your automation a descriptive name
2. Make sure "Active" is checked
3. Click "Create automation"

## Example Use Cases

### Customer Support Auto-Response

**Trigger**: When Status changes to "Needs Response"

**AI Instructions**:
```
Analyze the customer's request and generate a professional, helpful response.
Be polite, clear, and action-oriented.
```

**Field Mappings**:
- **Response** → "Generate a professional response addressing the customer's concern"
- **Priority** → "Determine urgency: Low, Medium, or High"
- **Category** → "Classify the request type (Bug, Feature Request, Question, etc.)"

### Project Task Breakdown

**Trigger**: When Status changes to "Planning"

**AI Instructions**:
```
Break down the project task into actionable steps and estimate complexity.
Consider dependencies and best practices.
```

**Field Mappings**:
- **Action Items** → "List 3-5 specific action items needed to complete this task"
- **Complexity** → "Rate complexity as Simple, Moderate, or Complex"
- **Estimated Hours** → "Provide a realistic time estimate in hours"

### Lead Qualification

**Trigger**: When Status changes to "New Lead"

**AI Instructions**:
```
Analyze the lead information and determine qualification level and next actions.
```

**Field Mappings**:
- **Lead Score** → "Rate from 1-10 based on fit and intent signals"
- **Recommended Action** → "Suggest immediate next step (Call, Email, Research, etc.)"
- **Notes** → "Summarize key points about this lead"

## Available Context

The AI has access to:
- **Item Name**: The task/item title
- **Board Name**: Which board this is on
- **All Field Values**: Every column's current value
- **Status Value**: The current status

## Field Types Supported

The AI can fill any field type:
- **Text**: Short text responses
- **Long Text**: Detailed explanations, lists, paragraphs
- **Number**: Numeric values, scores, estimates
- **Email**: Email addresses (if extracting from text)
- **Date**: Date values in standard formats
- **Money**: Monetary amounts

## Tips for Best Results

1. **Be Specific**: Clear instructions get better results
   - ❌ "Fill this field"
   - ✅ "Generate a 2-3 sentence professional response addressing the customer's concern"

2. **Provide Context**: Help the AI understand what to look for
   - ✅ "Based on the Description field, estimate delivery time in days"

3. **Set Constraints**: Guide the AI's format
   - ✅ "Choose one of: Low, Medium, High"
   - ✅ "Provide a number between 1-10"
   - ✅ "Write 3-5 bullet points"

4. **Test First**: Try with a test item before activating for all items

## Troubleshooting

### AI Not Filling Fields?

1. Check the automation is **Active** (green badge)
2. Verify the trigger status matches exactly
3. Check automation logs: Click "Automations" → View the automation
4. Make sure OPENROUTER_API_KEY is configured

### AI Response Not What You Expected?

1. Refine your instructions to be more specific
2. Add examples in your instructions
3. Specify the format you want
4. Check if the AI has the right source data in other fields

### Check Automation Logs

Go to `/debug/automations` to see:
- Which automations ran
- Whether they succeeded or failed
- Error messages if something went wrong
- AI responses and what was filled

## Viewing Logs

To see what the AI is doing:

1. Open browser DevTools (F12)
2. Go to the Network tab
3. Filter for "automation"
4. Check the Supabase Functions logs in your dashboard

Or use the debug console at `/debug/automations`

## Cost Considerations

The AI uses OpenRouter's API with Claude 3.5 Sonnet:
- Each automation trigger = 1 API call
- Cost depends on your OpenRouter usage
- Monitor your usage in the OpenRouter dashboard

## Security & Privacy

- AI processing happens server-side in Supabase Edge Functions
- Your OPENROUTER_API_KEY is stored securely as a Supabase secret
- Item data is only sent to OpenRouter for processing
- No data is stored by OpenRouter (as per their policy)

---

## Need Help?

- Check the automation logs at `/debug/automations`
- Review the console logs in browser DevTools
- Verify your configuration in the Automations modal
