export async function GET(request: Request) {
  return new Response(
    JSON.stringify({
      message: "Platform route works",
      path: new URL(request.url).pathname,
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
