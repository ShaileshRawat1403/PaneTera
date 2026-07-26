// src/utils/exportConversation.ts
//
// Export conversation history as Markdown or JSON.

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function exportAsMarkdown(messages: ChatMessage[]): string {
  const lines: string[] = [
    '# PaneTera Conversation',
    '',
    `Exported: ${new Date().toISOString()}`,
    '',
    '---',
    '',
  ];

  for (const msg of messages) {
    const prefix = msg.role === 'user' ? '**You:**' : '**PaneTera:**';
    lines.push(prefix, '', msg.content, '', '---', '');
  }

  return lines.join('\n');
}

export function exportAsJson(messages: ChatMessage[]): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    messages,
  }, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function copyToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}
