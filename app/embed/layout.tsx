import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import { EmbedProviders } from "@/components/embed/EmbedProviders";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function EmbedLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <EmbedProviders>
        <div className="embed-shell">{children}</div>
      </EmbedProviders>
    </NextIntlClientProvider>
  );
}
