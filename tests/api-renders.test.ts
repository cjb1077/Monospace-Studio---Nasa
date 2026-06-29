import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockGetUser,
  mockSingle,
  mockInsert,
  mockDelete,
  mockSelect,
  mockOrder,
  mockEq,
  mockInsertSelect,
  mockInsertSingle,
} = vi.hoisted(() => {
  const getUser = vi.fn();
  const single = vi.fn();
  
  const insertSingle = vi.fn();
  const insertSelect = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn(() => ({ select: insertSelect }));
  
  const eq = vi.fn();
  const del = vi.fn(() => ({ eq }));
  
  const order = vi.fn();
  const select = vi.fn(() => ({ order }));

  return {
    mockGetUser: getUser,
    mockSingle: single,
    mockInsert: insert,
    mockInsertSelect: insertSelect,
    mockInsertSingle: insertSingle,
    mockDelete: del,
    mockEq: eq,
    mockSelect: select,
    mockOrder: order,
  };
});

vi.mock("../src/lib/supabase/server", () => {
  const mockClient = {
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn((table: string) => {
      if (table === "renders") {
        return {
          select: mockSelect,
          insert: mockInsert,
          delete: mockDelete,
        };
      }
      return {};
    }),
  };
  return {
    getSupabaseServer: vi.fn(() => Promise.resolve(mockClient)),
    getSupabaseAdmin: vi.fn(),
  };
});

import { GET, POST } from "../src/app/api/renders/route";
import { DELETE } from "../src/app/api/renders/[id]/route";

describe("renders CRUD endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/renders", () => {
    it("should return renders list", async () => {
      const mockRows = [
        {
          id: "r1",
          user_id: "u1",
          title: "Art 1",
          ascii: "Art 1 Ascii",
          caption: "Cap 1",
          fun_fact: "Fact 1",
          source_date: "2026-06-28",
          is_public: true,
          created_at: "2026-06-29T00:00:00Z",
        },
      ];

      mockOrder.mockResolvedValue({ data: mockRows, error: null });

      const req = new NextRequest("http://localhost/api/renders");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.renders).toHaveLength(1);
      expect(body.renders[0].id).toBe("r1");
      expect(body.renders[0].userId).toBe("u1");
      expect(body.renders[0].isPublic).toBe(true);
    });
  });

  describe("POST /api/renders", () => {
    it("should return 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("Auth required") });

      const req = new NextRequest("http://localhost/api/renders", {
        method: "POST",
        body: JSON.stringify({
          title: "Art 1",
          ascii: "Art 1 Ascii",
          sourceDate: "2026-06-28",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.code).toBe("UNAUTHORIZED");
    });

    it("should return 400 when required fields are missing", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

      const req = new NextRequest("http://localhost/api/renders", {
        method: "POST",
        body: JSON.stringify({
          title: "Art 1",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.ok).toBe(false);
    });

    it("should save render successfully when user is authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      
      const mockSavedRow = {
        id: "r1",
        user_id: "u1",
        title: "Art 1",
        ascii: "Art 1 Ascii",
        caption: "Cap 1",
        fun_fact: "Fact 1",
        source_date: "2026-06-28",
        is_public: true,
        created_at: "2026-06-29T00:00:00Z",
      };

      mockInsertSingle.mockResolvedValue({ data: mockSavedRow, error: null });

      const req = new NextRequest("http://localhost/api/renders", {
        method: "POST",
        body: JSON.stringify({
          title: "Art 1",
          ascii: "Art 1 Ascii",
          caption: "Cap 1",
          funFact: "Fact 1",
          sourceDate: "2026-06-28",
          isPublic: true,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.render.id).toBe("r1");
      expect(body.render.userId).toBe("u1");
      expect(body.render.isPublic).toBe(true);
    });
  });

  describe("DELETE /api/renders/:id", () => {
    it("should return 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("Auth required") });

      const req = new NextRequest("http://localhost/api/renders/r1");
      const res = await DELETE(req, { params: Promise.resolve({ id: "r1" }) });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.code).toBe("UNAUTHORIZED");
    });

    it("should delete render successfully when user is authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      mockEq.mockResolvedValue({ data: null, error: null });

      const req = new NextRequest("http://localhost/api/renders/r1");
      const res = await DELETE(req, { params: Promise.resolve({ id: "r1" }) });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(mockEq).toHaveBeenCalledWith("id", "r1");
    });
  });
});
