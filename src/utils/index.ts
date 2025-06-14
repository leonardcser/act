import { ClassNameValue, twMerge } from "tailwind-merge";

export const cn = (...classes: ClassNameValue[]) => {
  return twMerge(classes);
};
