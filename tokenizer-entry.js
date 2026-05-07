import { Tiktoken } from "js-tiktoken/lite";
import o200kBase from "js-tiktoken/ranks/o200k_base";

const tokenizer = new Tiktoken(o200kBase);

globalThis.GPT_TOKEN_COUNTER_TOKENIZER = {
  encoding: "o200k_base",
  count(text) {
    return tokenizer.encode(text, [], "all").length;
  }
};
