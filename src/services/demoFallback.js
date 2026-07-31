export const shouldUseDemoFallback = ({
  development = false,
  allowDevelopmentFallback = false,
  sampleDataActive = false,
  remoteRows = [],
  remoteError = null,
  collections = null,
}) => Boolean(
  development &&
    (allowDevelopmentFallback || sampleDataActive) &&
    (collections
      ? collections.some((collection) => Boolean(collection.error) || (collection.rows || []).length === 0)
      : Boolean(remoteError) || remoteRows.length === 0),
);

export const resolveDemoRows = (remoteRows, localRows, useFallback) =>
  useFallback ? localRows : remoteRows || [];
