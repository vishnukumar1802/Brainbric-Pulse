/**
 * The agents' faces: an AI-generated portrait of a fictional person per agent (public/avatars/<slug>.jpg and
 * <slug>-face.jpg), their default name, and the outfit the office draws them in so the walking figure matches the photo.
 */
export type HairStyle = 'short' | 'long' | 'bun' | 'bob' | 'curly' | 'ponytail';

export type Look = {
  skin: string;
  hair: string;
  style: HairStyle;
  /** Outer layer (jacket, blazer, shirt) and what shows underneath it (t-shirt, top, tie). */
  top: string;
  inner: string;
  pants: string;
  glasses?: boolean;
  headset?: boolean;
  beard?: boolean;
};

export type AgentAvatar = { name: string; look: Look; photo: boolean };

export const AGENT_AVATARS: Record<string, AgentAvatar> = {
  'lead-hunter': { name: 'Arjun', photo: true, look: { skin: '#B07A55', hair: '#15100D', style: 'short', top: '#1F2D4D', inner: '#F4F4F2', pants: '#2B2F3A', beard: true } },
  'requirement-hunter': { name: 'Priya', photo: true, look: { skin: '#C98F66', hair: '#1A110D', style: 'long', top: '#8FA98A', inner: '#F1E9DA', pants: '#3A3A3A' } },
  'inbox-assistant': { name: 'Karthik', photo: true, look: { skin: '#A8714C', hair: '#2A1C14', style: 'short', top: '#1C1C1E', inner: '#8D8D8D', pants: '#26282E', headset: true } },
  'college-outreach': { name: 'Meena', photo: true, look: { skin: '#9E6A45', hair: '#15100D', style: 'bun', top: '#6E93BF', inner: '#D8A532', pants: '#2D2F36' } },
  'daily-brief': { name: 'Divya', photo: true, look: { skin: '#C7916B', hair: '#1E1510', style: 'bob', top: '#C49A6C', inner: '#FFFFFF', pants: '#2E2E30', glasses: true } },
  'social-content': { name: 'Rahul', photo: true, look: { skin: '#A06A47', hair: '#120D0A', style: 'curly', top: '#5E6B45', inner: '#1A1A1A', pants: '#2A2D33' } },
  'competitor-watch': { name: 'Sneha', photo: true, look: { skin: '#B07B57', hair: '#120E0B', style: 'ponytail', top: '#151515', inner: '#151515', pants: '#1E1E22' } },
  'mail-watcher': { name: 'Vikram', photo: false, look: { skin: '#A97650', hair: '#16110D', style: 'short', top: '#9DBBE0', inner: '#9DBBE0', pants: '#3A4252', headset: true } },
  'support-desk': { name: 'Kavya', photo: false, look: { skin: '#B5805C', hair: '#16100C', style: 'long', top: '#1C1C1F', inner: '#F4F4F2', pants: '#1F1F23', headset: true } },
  'devops-watch': { name: 'Aditya', photo: false, look: { skin: '#A8714C', hair: '#120D0A', style: 'short', top: '#2A3552', inner: '#E9EEF5', pants: '#262B38', glasses: true } },
  'team-lead': { name: 'Arvind', photo: false, look: { skin: '#A8714C', hair: '#16100C', style: 'short', top: '#1A1A1D', inner: '#F4F4F2', pants: '#1F1F23', beard: true } },
  developer: { name: 'Nikhil', photo: false, look: { skin: '#B07A55', hair: '#15100D', style: 'short', top: '#4A5A6E', inner: '#DADFE6', pants: '#2B2F3A', headset: true } },
  'qa-tester': { name: 'Pooja', photo: false, look: { skin: '#C08A62', hair: '#1A110D', style: 'ponytail', top: '#7B5EA7', inner: '#F1E9DA', pants: '#2D2F36', glasses: true } },
};

export function agentPhoto(slug: string | null | undefined, kind: 'face' | 'card' = 'face'): string | null {
  if (!slug || !AGENT_AVATARS[slug]?.photo) return null;
  return kind === 'face' ? `/avatars/${slug}-face.jpg` : `/avatars/${slug}.jpg`;
}
