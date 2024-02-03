import { Spinner, SpinnerSizes } from "flowbite-react";

interface LoaderProps {
  size?: keyof SpinnerSizes;
}

const Loader = ({ size }: LoaderProps) => {
  return <Spinner color="warning" size={size} className="text-gray-600" />;
};

export default Loader;
