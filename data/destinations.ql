[out:json][timeout:90];
(
  way["building"](23.144,72.664,23.187,72.714);
  way["building:part"](23.144,72.664,23.187,72.714);
  relation["building"](23.144,72.664,23.187,72.714);
  way["highway"](23.144,72.664,23.187,72.714);
  way["landuse"](23.144,72.664,23.187,72.714);
  way["leisure"](23.144,72.664,23.187,72.714);
  way["natural"="water"](23.144,72.664,23.187,72.714);
  nwr["name"~"GIFT",i](23.144,72.664,23.187,72.714);
  way["highway"](23.215,72.628,23.239,72.659);
  way["building"](23.215,72.628,23.239,72.659);
  way["leisure"](23.215,72.628,23.239,72.659);
  way["landuse"~"grass|forest|recreation_ground"](23.215,72.628,23.239,72.659);
  way["natural"~"water|wood|scrub"](23.215,72.628,23.239,72.659);
  nwr["name"~"Swarnim|Central Vista|Mahatma",i](23.215,72.628,23.239,72.659);
);
out body geom;
