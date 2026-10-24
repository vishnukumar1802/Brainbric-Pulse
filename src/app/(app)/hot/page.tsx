import { redirect } from 'next/navigation';

export default function HotLeads() {
  redirect('/leads?status=hot');
}
