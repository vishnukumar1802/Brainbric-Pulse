'use client';

import { createContext, useContext } from 'react';
import type { Sender } from '@/lib/links';

// Who is signed in, for the send buttons: admins open the agent's Outlook draft, team members compose in their own mailbox.
const SenderContext = createContext<Sender>({ isAdmin: true, email: null, signature: null, bcc: null, baseUrl: '' });

export function SenderProvider({ sender, children }: { sender: Sender; children: React.ReactNode }) {
  return <SenderContext.Provider value={sender}>{children}</SenderContext.Provider>;
}

export function useSender(): Sender {
  return useContext(SenderContext);
}
