// prints standalone SVGs for the app icon (rounded + full-bleed for iOS)
print(JSON.stringify({
  rounded: FF.art.defs().replace(/<svg[^>]*>/, '').replace('</svg>', '') ,
  logo: FF.art.logo(1024, true),
  full: FF.art.logo(1024, false)
}));
