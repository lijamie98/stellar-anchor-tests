import { default as tomlTests } from "./toml";
import { default as infoTests } from "./info";
import { default as depositTests } from "./deposit";
import { default as withdrawTests } from "./withdraw";

export default tomlTests.concat(infoTests, depositTests, withdrawTests);
