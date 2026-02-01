// https://vike.dev/Head

import logoUrl from '../assets/logo.svg';

export function Head() {
  return (
    <>
      <link rel="icon" href={logoUrl} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#131316" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content="isolated-workers" />
      <meta
        property="og:description"
        content="Type-safe worker processes with end-to-end message contracts"
      />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="isolated-workers" />
      <meta
        name="twitter:description"
        content="Type-safe worker processes with end-to-end message contracts"
      />
    </>
  );
}
