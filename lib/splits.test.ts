import { describe, expect, it } from "vitest";
import { assertSplitTotal, splitEqual, splitPercentage } from "./splits";
describe("expense splitting", () => {
  it("distributes rounding cents deterministically", () => expect(splitEqual(1000,["c","a","b"])).toEqual([{userId:"a",cents:334},{userId:"b",cents:333},{userId:"c",cents:333}]));
  it("keeps percentage splits cent exact", () => { const result=splitPercentage(10001,[{userId:"a",value:60},{userId:"b",value:40}]); assertSplitTotal(10001,result); expect(result).toEqual([{userId:"a",cents:6001},{userId:"b",cents:4000}]); });
  it("rejects percentages that are not 100", () => expect(()=>splitPercentage(100,[{userId:"a",value:20}])).toThrow("PERCENTAGE_MUST_EQUAL_100"));
});
