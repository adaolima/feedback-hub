import type { Metadata } from "next";
import React from "react";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { WorkspaceProvider } from "@/lib/WorkspaceContext";

export const metadata: Metadata = {
  title: "FeedbackHub",
  description: "Self-hosted feedback & survey widget platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
