import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EE Demo — Learning Center Management',
  description: 'Hệ thống quản lý trung tâm dạy học EE Demo',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head />
      <body>{children}</body>
    </html>
  );
}
