process.on('message', (m: any) => {
  if (m.type === 'start') process.send?.({type: 'gate', kind: 'model', id: 'attempt'});
  if (m.type === 'allow') process.send?.({type: 'event', event: {type: 'started'}});
  if (m.type === 'abort') {
    process.send?.({
      type: 'event',
      event: {type: 'usage', usage: {input: 0, output: 0, cost: {total: 0}}, stopReason: 'aborted'},
    });
    process.send?.({
      type: 'result',
      result: {schemaVersion: 1, role: 'analyst', text: 'late', data: {}, executions: [], readPaths: []},
    });
  }
});
setInterval(() => {}, 1000);
