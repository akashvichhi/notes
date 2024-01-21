import { ForwardedRef, InputHTMLAttributes, forwardRef } from "react";

const Input = forwardRef((props: InputHTMLAttributes<HTMLInputElement>, ref: ForwardedRef<HTMLInputElement>) => {
  const className = props.className;
  return (
    <input
      ref={ref}
      className={`block w-full border-2 border-gray-300 rounded-md border-1 px-3 py-1.5 text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-600 sm:text-sm sm:leading-6 ${className}`}
      {...props}
    />
  );
});

export default Input;
