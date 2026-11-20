export default async (): Promise<Response> => {
  return Response.json({ ok: true, service: "skillswap-api" });
};
