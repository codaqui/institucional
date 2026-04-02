import ComponentTypes from "@theme-original/NavbarItem/ComponentTypes";
import NavbarAuth from "@site/src/components/NavbarAuth";

type ComponentTypesMap = typeof ComponentTypes;

const CustomComponentTypes: ComponentTypesMap & {
  "custom-authButton": typeof NavbarAuth;
} = {
  ...ComponentTypes,
  "custom-authButton": NavbarAuth,
};

export default CustomComponentTypes;
