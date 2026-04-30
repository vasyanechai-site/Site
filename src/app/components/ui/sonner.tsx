import { Toaster as Sonner, ToasterProps } from "sonner@2.0.3";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-center"
      className="toaster group"
      toastOptions={{
        style: {
          background: '#FFF4E5',
          border: '1px solid rgba(34, 34, 34, 0.1)',
          color: '#222222',
        },
        className: '',
      }}
      {...props}
    />
  );
};

export { Toaster };