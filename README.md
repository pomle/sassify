# sassify

Convert a makeStyles JSS project to Sass module codebase.

## Usage

1. Clone repo
1. `yarn install`
1. `yarn build`
1. `node ./build/main.js [dir with tsconfig.json]`

If a property was not automatically convertable, the literal value will be put in the Sass as comment.

```sass
.indicator
  background: #fffe
  border-radius: 10px
  /* FIXME: Unknown prop value
   * left:
   * (props: StyleProps) => (props.on ? "0px" : "calc(100% - 24px)")
   */
  height: 20px
```
