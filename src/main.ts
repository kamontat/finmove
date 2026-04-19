import { render } from "ink";
import React from "react";
import { parseArgs } from "./core/parse-args";
import { App } from "./tui/app";

const args = parseArgs(process.argv.slice(2));
console.clear();
render(React.createElement(App, { args }));
