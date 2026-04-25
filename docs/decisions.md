# Decisions

1. Camera is its own module, responsible for viewport state and coordinate conversion between viewport and world. View sends viewport-relative coordinates; model uses the camera module to interpret them.
