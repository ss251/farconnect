import type { Metadata } from 'next';

import { getSession } from '~/auth';
import '~/app/globals.css';
import '~/styles/globals.css';
import { Providers } from '~/app/providers';
import { APP_NAME, APP_DESCRIPTION } from '~/lib/constants';

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html lang="en" className="dark">
      <body className="dark">
        <Providers session={session}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
