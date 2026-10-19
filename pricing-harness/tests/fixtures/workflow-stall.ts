import {createStageBashOperations} from '../../src/agent/workflow/supervised-shell.js';
process.on('SIGTERM', () => {});
process.on('message', (m: any) => {
  if (m.type === 'start') {
    void createStageBashOperations().exec(
      `${process.execPath} -e 'setTimeout(()=>require("fs").writeFileSync(process.argv[1],"late"),700)' ${m.request.stageDir}/late.txt`,
      m.request.stageDir,
      {onData: () => {}},
    );
    process.send?.({type: 'ready'});
  }
});
setInterval(() => {}, 1000);
