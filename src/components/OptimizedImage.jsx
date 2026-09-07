import React, { useState } from 'react';

/**
 * High-performance image component with:
 * - Native lazy-loading & asynchronous decoding
 * - Priority loading for above-the-fold hero & logo assets
 * - Smooth fade-in on load to prevent visual pop-in
 * - Automatic fallback on load errors
 */
export const OptimizedImage = React.memo(({
  src,
  alt = '',
  className = '',
  priority = false,
  fallbackSrc = '/default-avatar.webp',
  onClick,
  style,
  ...rest
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const displaySrc = hasError || !src ? fallbackSrc : src;

  return (
    <img
      src={displaySrc}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onLoad={() => setIsLoaded(true)}
      onError={() => {
        if (!hasError && fallbackSrc && src !== fallbackSrc) {
          setHasError(true);
        }
      }}
      onClick={onClick}
      style={style}
      className={`${className} ${
        isLoaded ? 'opacity-100' : 'opacity-85'
      } transition-opacity duration-300`}
      {...rest}
    />
  );
});

export default OptimizedImage;
