'use client';

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Upload, ImageIcon, Send } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
  suggestedAction?: {
    action: string;
    itemName?: string;
    items?: Array<{ itemName: string; cellValues: Record<string, any> }>;
    cellValues?: Record<string, any>;
  };
}

export function BoardChatbot({ boardId, onClose }: { boardId: string; onClose?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasWelcomed, setHasWelcomed] = useState(false);
  const [suggestedAction, setSuggestedAction] = useState<{
    action: string;
    itemName?: string;
    items?: Array<{ itemName: string; cellValues: Record<string, any> }>;
    cellValues?: Record<string, any>
  } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send welcome message on mount
  useEffect(() => {
    if (!hasWelcomed && messages.length === 0) {
      setHasWelcomed(true);
      // Trigger welcome by sending empty messages array
      const triggerWelcome = async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/chat/board", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: [], boardId }),
          });
          const data = await res.json();
          if (res.ok && data.messages) {
            setMessages(data.messages);
          }
        } catch (error) {
          console.error("Welcome message error:", error);
        } finally {
          setLoading(false);
        }
      };
      triggerWelcome();
    }
  }, [hasWelcomed, boardId]);

  const processImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) {
      const base64 = await processImage(file);
      setPendingImage(base64);
    }
  }, []);

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        const base64 = await processImage(file);
        setPendingImage(base64);
      }
    }
    // Non-image pastes (text) proceed with default input paste behavior
  };

  const sendMessage = async () => {
    if (!input.trim() && !pendingImage && !fileInputRef.current?.files?.[0]) return;

    let userContent: Message["content"];
    let base64 = pendingImage;

    // Check file input if no pending image from paste/drop
    if (!base64 && fileInputRef.current?.files?.[0]) {
      base64 = await processImage(fileInputRef.current.files[0]);
    }

    if (base64) {
      userContent = [
        { type: "text" as const, text: input.trim() || "Analyze screenshot for board data." },
        { type: "image_url" as const, image_url: { url: base64 } }
      ];
    } else {
      userContent = input.trim() || "Message sent.";
    }

    const userMsg: Message = { role: "user", content: userContent };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setPendingImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await sendApi(newMessages);
  };

  const sendApi = async (currentMessages: Message[]) => {
    setLoading(true);
    setSuggestedAction(null);
    try {
      const res = await fetch("/api/chat/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: currentMessages, boardId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "API error");
      const newMsgs = data.messages || [];
      setMessages(prev => [...prev, ...newMsgs.slice(-1)]);

      // Check if items were automatically added/updated
      if (data.addedItemIds?.length > 0 || data.updatedItemIds?.length > 0) {
        const updatedCount = data.updatedItemIds?.length || 0;
        const addedCount = data.addedItemIds?.length || 0;

        if (addedCount > 0 && updatedCount > 0) {
          toast.success(`${updatedCount} üksust uuendatud, ${addedCount} uut lisatud!`);
        } else if (updatedCount > 0) {
          toast.success(`${updatedCount} ${updatedCount === 1 ? 'üksus' : 'üksust'} uuendatud!`);
        } else if (addedCount > 0) {
          toast.success(`${addedCount} ${addedCount === 1 ? 'üksus' : 'üksust'} lisatud!`);
        }

        // Reload to show changes
        window.location.reload();
      } else if (data.suggestedAction) {
        // Only set suggested action if NOT automatically processed
        setSuggestedAction(data.suggestedAction);
      }
    } catch (error) {
      toast.error((error as Error).message);
      setMessages(prev => [...prev, { role: "assistant", content: "Vabandust, tekkis viga." }]);
    } finally {
      setLoading(false);
    }
  };

  const addSuggested = async () => {
    if (!suggestedAction) return;
    setLoading(true);
    try {
      const res = await fetch("/api/chat/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, boardId, addData: suggestedAction }),
      });
      const data = await res.json();
      if (data.updatedItemIds && data.updatedItemIds.length > 0) {
        const updatedCount = data.updatedItemIds.length;
        const addedCount = data.addedItemIds?.length || 0;
        if (addedCount > 0) {
          toast.success(`${updatedCount} üksust uuendatud, ${addedCount} uut lisatud!`);
        } else {
          toast.success(`${updatedCount} ${updatedCount === 1 ? 'üksus' : 'üksust'} uuendatud!`);
        }
        setSuggestedAction(null);
        window.location.reload();
      } else if (data.addedItemIds && data.addedItemIds.length > 0) {
        const count = data.addedItemIds.length;
        toast.success(`${count} ${count === 1 ? 'üksus' : 'üksust'} lisatud!`);
        setSuggestedAction(null);
        window.location.reload();
      } else if (data.addedItemId) {
        toast.success(`"${suggestedAction.itemName}" lisatud!`);
        setSuggestedAction(null);
        window.location.reload();
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[80vh] flex flex-col">
      <ScrollArea className="flex-1 p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`p-3 rounded-lg max-w-[85%] ${msg.role === "user" ? "bg-blue-500 text-white" : "bg-muted"
              }`}>
              {typeof msg.content === "string" ? msg.content : (
                <div>
                  {Array.isArray(msg.content) && msg.content.map((part, j) => (
                    <div key={j}>
                      {part.type === "text" && part.text}
                      {part.type === "image_url" && <img src={part.image_url.url} alt="Uploaded" className="max-w-xs mt-2 rounded" />}
                    </div>
                  ))}
                </div>
              )}
              {msg.suggestedAction && (
                <div className="mt-2 p-2 bg-green-100 rounded text-xs">
                  {msg.suggestedAction.action === "add_items" && msg.suggestedAction.items
                    ? `AI soovitab: ${msg.suggestedAction.items.length} üksust`
                    : `AI soovitab: ${msg.suggestedAction.itemName}`}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-center p-4 text-muted-foreground">AI analüüsib...</div>}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {suggestedAction && (
        <div className="p-4 border-t bg-green-50">
          <div className="text-sm mb-2">
            {suggestedAction.action === "add_items"
              ? `Lisa ${suggestedAction.items?.length || 0} üksust tabelisse:`
              : "Lisa tabelisse:"}
          </div>
          {suggestedAction.action === "add_items" && suggestedAction.items ? (
            <div className="max-h-48 overflow-y-auto mb-2 space-y-1">
              {suggestedAction.items.map((item, idx) => (
                <div key={idx} className="text-xs p-2 bg-white rounded">
                  <div className="font-medium">{item.itemName}</div>
                  {Object.entries(item.cellValues || {}).length > 0 && (
                    <div className="text-muted-foreground mt-1">
                      {Object.entries(item.cellValues).map(([colId, val]) => (
                        <span key={colId} className="mr-2">
                          {typeof val === 'string' ? val : JSON.stringify(val)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs p-2 bg-white rounded mb-2">
              {suggestedAction.itemName}
              {suggestedAction.cellValues && Object.keys(suggestedAction.cellValues).length > 0 && (
                <div className="text-muted-foreground mt-1">
                  {Object.entries(suggestedAction.cellValues).map(([colId, val]) => (
                    <span key={colId} className="mr-2">
                      {typeof val === 'string' ? val : JSON.stringify(val)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          <Button onClick={addSuggested} className="w-full" disabled={loading}>
            ➕ {suggestedAction.action === "update_or_add_items"
              ? `Uuenda/Lisa ${suggestedAction.items?.length || 0} üksust`
              : suggestedAction.action === "add_items"
                ? `Lisa ${suggestedAction.items?.length || 0} üksust`
                : "Lisa üksus"}
          </Button>
        </div>
      )}

      <div
        className={`p-4 border-t flex gap-2 items-center transition-all ${dragActive ? "border-2 border-dashed border-blue-400 bg-blue-50" : ""
          }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            if (e.target.files?.[0]) {
              const base64 = await processImage(e.target.files[0]);
              setPendingImage(base64);
            }
          }}
        />
        {pendingImage && (
          <div className="relative mr-2">
            <img src={pendingImage} alt="Pending" className="h-10 w-10 object-cover rounded border" />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
            >
              ✕
            </button>
          </div>
        )}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={handlePaste}
          placeholder={dragActive ? "Lohista ekraanipilt siia..." : "Kirjuta sõnum või lohista ekraanipilt... (või kleebi Ctrl+V)"}
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && !loading && sendMessage()}
          disabled={loading}
        />
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          size="icon"
          disabled={loading}
          title="Upload screenshot"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <Button onClick={sendMessage} disabled={loading} size="icon">
          <Send className="h-4 w-4" />
        </Button>
        {onClose && (
          <Button onClick={onClose} variant="ghost" size="icon">
            ✕
          </Button>
        )}
        {dragActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/10 rounded">
            <ImageIcon className="h-8 w-8 text-blue-500" />
          </div>
        )}
      </div>
    </div>
  );
}
