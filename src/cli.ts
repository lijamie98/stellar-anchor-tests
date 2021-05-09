#!/usr/bin/env node
import yargs from "yargs";
import { URL } from "url";
import fetch from "node-fetch";
import { parse } from "toml";
import { Networks } from "stellar-sdk";

import { run } from "./helpers/run";
import { getStats } from "./helpers/stats";
import { Config, SEP, TestRun } from "./types";
import { printTestRun, printStats } from "./helpers/console";

const args = yargs
  .options({
    "home-domain": {
      alias: "h",
      requiresArg: true,
      demandOption: true,
      type: "string",
      description:
        "The home domain of the anchor. The anchor's TOML file should be present at <home-domain>/.well-known/stellar.toml. Prepends 'https://' if no protocol is specified.",
    },
    currency: {
      alias: "c",
      requiresArg: true,
      type: "string",
      description:
        "The currency to use for testing. Must match one of the CURRENCIES listed in the TOML file.",
    },
    seps: {
      alias: "s",
      type: "array",
      requiresArg: true,
      demandOption: true,
      coerce: (arg: Array<string>) => arg.map((x) => parseInt(x)),
      description: "A list of numbers corresponding to the SEPs to test.",
    },
    verbose: {
      alias: "v",
      type: "boolean",
      default: false,
      description:
        "Display the each request and response used in each failed test.",
    },
  })
  .check((argv: any) => {
    if (!argv.homeDomain.startsWith("http")) {
      argv.homeDomain = `https://${argv.homeDomain}`;
      argv.h = `https://${argv.homeDomain}`;
      argv["home-domain"] = `https://${argv.homeDomain}`;
    }
    let url;
    try {
      url = new URL(argv.homeDomain);
    } catch {
      throw "error: --home-domain is not a valid URL.";
    }
    if (`${url.protocol}//${url.host}/` !== url.toString()) {
      throw "error: --home-domain includes protocol, hostname, and port.";
    }
    if (argv.seps) {
      for (const sep of argv.seps) {
        if (![1, 6, 10, 12, 24, 31].includes(sep))
          throw "error: invalid --sep value provided. Choices: 1, 6, 10, 12, 24, 31.";
      }
    }
    return true;
  }).argv;

(async () => {
  const config: Config = {
    homeDomain: args.homeDomain as string,
    seps: args.seps as SEP[],
  };
  if (args._.length) config.searchStrings = args._.map(String);
  if (args.currency) config.currency = args.currency as string;
  if (args.verbose) config.verbose = args.verbose as boolean;
  let tomlObj;
  try {
    const tomlResponse = await fetch(
      config.homeDomain + "/.well-known/stellar.toml",
    );
    tomlObj = parse(await tomlResponse.text());
  } catch {}
  if (tomlObj) {
    if (
      ![Networks.PUBLIC, Networks.TESTNET].includes(tomlObj.NETWORK_PASSPHRASE)
    ) {
      console.error(
        "error: NETWORK_PASSPHRASE is not one of the accepted values:\n\n" +
          `'${Networks.TESTNET}'\n'${Networks.PUBLIC}\n'`,
      );
      return;
    }
    config.networkPassphrase = tomlObj.NETWORK_PASSPHRASE;
  }
  const startTime = Date.now();
  const testRuns: TestRun[] = [];
  for await (const testRun of run(config)) {
    testRuns.push(testRun);
    await printTestRun(testRun, config.verbose as boolean);
  }
  const endTime = Date.now();
  console.log(); // add new line between results and stats
  printStats(getStats(testRuns), startTime, endTime);
})();
