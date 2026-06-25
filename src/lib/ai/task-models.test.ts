import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getTaskModel, withTaskModel } from "./task-models";
import type { AIConfig } from "@/lib/ai-models";

describe("task model routing", () => {
  it("routes full resume tailoring by plan", () => {
    assert.equal(getTaskModel("jobTailoring", false), "claude-haiku-4-5-20251001");
    assert.equal(getTaskModel("jobTailoring", true), "claude-opus-4-7");
  });

  it("routes extraction and scoring to Claude Haiku", () => {
    assert.equal(getTaskModel("structuredExtraction", false), "claude-haiku-4-5-20251001");
    assert.equal(getTaskModel("structuredExtraction", true), "claude-haiku-4-5-20251001");
    assert.equal(getTaskModel("resumeScoring", false), "claude-sonnet-4-6");
    assert.equal(getTaskModel("resumeScoring", true), "claude-sonnet-4-6");
  });

  it("routes bullet generation and cover letters to Claude Sonnet", () => {
    assert.equal(getTaskModel("contentGeneration", false), "claude-sonnet-4-6");
    assert.equal(getTaskModel("contentGeneration", true), "claude-sonnet-4-6");
    assert.equal(getTaskModel("coverLetter", false), "claude-sonnet-4-6");
    assert.equal(getTaskModel("coverLetter", true), "claude-sonnet-4-6");
  });

  it("routes chat assistant by plan", () => {
    assert.equal(getTaskModel("chatAssistant", false), "claude-haiku-4-5-20251001");
    assert.equal(getTaskModel("chatAssistant", true), "claude-opus-4-7");
  });

  it("preserves API keys and custom prompts while replacing the model", () => {
    const config: AIConfig = {
      model: "claude-sonnet-4-6",
      apiKeys: [
        { service: "anthropic", key: "user-anthropic", addedAt: "2026-05-10" },
      ],
      customPrompts: {
        textAnalyzer: "Extract carefully.",
      },
    };

    const resolved = withTaskModel({
      task: "structuredExtraction",
      isPro: false,
      config,
    });

    assert.equal(resolved.model, "claude-haiku-4-5-20251001");
    assert.deepEqual(resolved.apiKeys, config.apiKeys);
    assert.deepEqual(resolved.customPrompts, config.customPrompts);
  });

  it("can intentionally preserve a selected model for future override paths", () => {
    const resolved = withTaskModel({
      task: "chatAssistant",
      isPro: true,
      config: {
        model: "claude-opus-4-7",
        apiKeys: [],
      },
      respectSelectedModel: true,
    });

    assert.equal(resolved.model, "claude-opus-4-7");
  });
});
