attribute vec2 position;
attribute vec2 textureCoord;
uniform vec2 size;
uniform mat4 transform;
varying vec2 tc;
void main(void) {
  gl_Position = vec4(size * (textureCoord - vec2(0.5, 0.5)), 0, 0) +
                transform * vec4(position, 0, 1);
  tc = textureCoord;
}