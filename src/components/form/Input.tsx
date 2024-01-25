import { ForwardedRef, InputHTMLAttributes, forwardRef } from "react";

interface InputProps {
  className?: string;
  leftIcon?: JSX.Element;
  rightIcon?: JSX.Element;
  helperText?: string;
  color?: string;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

const Input = forwardRef(
  (props: InputProps, ref: ForwardedRef<HTMLInputElement>) => {
    let helperTextColor: string = props.color ?? "";
    switch (props.color) {
      case "error":
        helperTextColor = "text-red-600";
        break;
    }

    return (
      <div className={"relative"}>
        <input
          ref={ref}
          className={`block w-full bg-gray-50 border-2 border-gray-300 rounded-md border-1 px-3 py-1.5 text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-600 sm:text-sm sm:leading-6 ${props.className} ${props.leftIcon ? "pl-9" : ""} ${props.rightIcon ? "pr-9" : ""}`}
          {...props.inputProps}
        />
        {props.leftIcon && (
          <div
            className={
              "absolute top-3 left-0 flex items-center pl-3 text-gray-600"
            }
          >
            {props.leftIcon}
          </div>
        )}
        {props.rightIcon && (
          <div
            className={
              "absolute top-3 right-0 flex items-center pr-3 text-gray-600"
            }
          >
            {props.rightIcon}
          </div>
        )}
        {props.helperText && (
          <p className={`text-sm font-medium mt-1 ${helperTextColor}`}>
            {props.helperText}
          </p>
        )}
      </div>
    );
  },
);

export default Input;
