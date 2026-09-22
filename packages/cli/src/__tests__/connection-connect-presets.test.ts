// TEST_OVERVIEW: Connection creation honors public template presets before requiring command-line input.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionTemplateView } from "api-server-api";
import { buildConnectCommand } from "../modules/connection/commands/connect.js";
import type { ConnectionService } from "../modules/connection/services/connection-service.js";
import { EXIT_SUCCESS } from "../modules/shared/exit-codes.js";

const template: ConnectionTemplateView = {
  id: "custom-header",
  name: "Custom header",
  category: "other",
  isCustom: true,
  authKind: "header",
  inputs: [
    { name: "host", state: "required" },
    {
      name: "headerName",
      state: "required",
      presetValue: "Authorization",
    },
    {
      name: "valueFormat",
      state: "required",
      presetValue: "Bearer {value}",
    },
    { name: "value", state: "required", secret: true },
  ],
};

describe("dam connection connect template presets", () => {
  beforeEach(() => {
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`exit ${code}`);
    });
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
  });

  afterEach(() => vi.restoreAllMocks());

  it("uses required input presets when their flags are omitted", async () => {
    const createConnection = vi.fn().mockResolvedValue({
      ok: true,
      value: { id: "conn-1" },
    });
    const service = {
      listTemplates: vi.fn().mockResolvedValue({ ok: true, value: [template] }),
      createConnection,
    } as unknown as ConnectionService;
    const command = buildConnectCommand({
      compatService: {
        check: vi.fn().mockResolvedValue({
          ok: true,
          value: { kind: "ok", localCli: "1.0.0", serverVersion: "1.0.0" },
        }),
      },
      configService: {
        getResolved: vi.fn().mockResolvedValue({
          ok: true,
          value: { server: "http://localhost:4444" },
        }),
        set: vi.fn(),
      },
      createConnectionService: () => service,
      browserOpener: { open: vi.fn() },
    });

    await expect(
      command.parseAsync(
        ["custom-header", "--host", "api.example.com", "--value", "secret"],
        { from: "user" },
      ),
    ).rejects.toThrow(`exit ${EXIT_SUCCESS}`);

    expect(createConnection).toHaveBeenCalledWith({
      templateId: "custom-header",
      name: "custom-header",
      authKind: "header",
      host: "api.example.com",
      headerName: "Authorization",
      valueFormat: "Bearer {value}",
      value: "secret",
    });
    expect(process.stderr.write).toHaveBeenCalledWith(
      "Using preset values (Header name, Value format). Pass --header-name, --value-format to use your own.\n",
    );
  });
});
