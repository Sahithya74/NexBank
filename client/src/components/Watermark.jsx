/** Developer credit. Deliberately quiet - a product credit, not an advertisement. */
export default function Watermark({ variant = 'default', className = '' }) {
  return (
    <p className={`watermark ${variant === 'aside' ? 'watermark--aside' : ''} ${className}`}>
      Designed and Developed by Sahithya K.
    </p>
  );
}
