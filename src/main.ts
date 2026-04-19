import { render } from "ink";
import React from "react";
import { parseArgs } from "./core/parseArgs";
import { App } from "./tui/App";

console.clear();

const args = parseArgs(process.argv.slice(2));
render(React.createElement(App, { args }));
