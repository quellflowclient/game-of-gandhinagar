Local ride audio
================
Only audio you are authorised to bundle belongs here. No commercial recordings
were downloaded with this change.

For all players: add car.mp3, bike.mp3, auto.mp3, scooter.mp3, cycle.mp3 here,
then set the corresponding manifest.json values, e.g.:
"car": "/audio/rides/car.mp3"

For this device only: Game Hub > Sound > Local ride songs > Choose audio.
The browser saves the selected file in IndexedDB; it is never uploaded.
Device-selected audio takes priority over the bundled manifest.
Songs automatically loop on mounting, switch with the ride, and stop on dismount.
An initial tap can still be required by mobile browser audio policy.
