const exec = require("child_process").exec;
const cmd = "python3 telegram.py";

exec(cmd, function(error, stdout, stderr) {
  console.log(stdout.split(/\r?\n/));
});
