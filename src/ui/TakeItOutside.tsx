// On a laptop or desktop everything works, but passes happen outdoors.
// Hand the page to a phone with one scan.
export function TakeItOutside() {
  return (
    <aside
      aria-labelledby="outside"
      className="hidden rounded-lg border border-hair p-5 wide:block"
    >
      <div className="flex items-center gap-5">
        <img
          src="/qr.svg"
          alt="QR code linking to skypassalert.com"
          width="112"
          height="112"
          className="rounded-sm"
        />
        <div>
          <h2 id="outside" className="text-lg font-semibold">
            Take it outside
          </h2>
          <p className="mt-1 text-ink-2">
            Passes happen outdoors. Point your phone’s camera here to bring this page along.
          </p>
        </div>
      </div>
    </aside>
  )
}
