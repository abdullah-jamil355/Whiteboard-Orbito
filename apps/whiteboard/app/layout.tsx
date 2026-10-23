import type { Metadata } from "next";
import type { ReactElement } from "react";
import type { WhiteboardLayoutProps } from "@/types";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbito",
  description: "A standalone Orbito workspace."
};

const RootLayout = ({ children }: WhiteboardLayoutProps): ReactElement => (
  <html data-theme="dark" lang="en">
    <body>{children}</body>
  </html>
);

export default RootLayout;
