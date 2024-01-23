import { ForwardedRef, InputHTMLAttributes, forwardRef } from "react";

interface InputProps {
  leftIcon?: JSX.Element;
  rightIcon?: JSX.Element;
}

const Input = forwardRef(
  (
    props: InputHTMLAttributes<HTMLInputElement> & InputProps,
    ref: ForwardedRef<HTMLInputElement>
  ) => {
    const className = props.className;
    return (
      <div className={"relative"}>
        <input
          ref={ref}
          className={`block w-full border-2 border-gray-300 rounded-md border-1 px-3 py-1.5 text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-600 sm:text-sm sm:leading-6 ${className} ${props.leftIcon ? "pl-9" : ""} ${props.rightIcon ? "pr-9" : ""}`}
          {...props}
        />
        {props.leftIcon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            {props.leftIcon}
          </div>
        )}
        {props.rightIcon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {props.rightIcon}
          </div>
        )}
      </div>
    );
  }
);

export default Input;
