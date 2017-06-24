/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const traceJson = require('../../../lib/traces/trace-json');
const fs = require('fs');
const assert = require('assert');


/* eslint-env mocha */
describe('tracejson parser', () => {
  it('returns preact trace data the same as JSON.parse', (done) => {
    const filename = '../../fixtures/traces/preactjs.com_2017-01-04_15-36-36-0.trace.json';
    const readStream = fs.createReadStream(__dirname + '/' + filename, {
      encoding: 'utf-8',
      // devtools sends traces in 10mb chunks, but this trace is 12MB so we'll do a few chunks
      highWaterMark: 4 * 1024 * 1024
    });
    const parser = new traceJson.TraceParser();

    readStream.on('data', (chunk) => {
      parser.parseChunk(chunk);
    });
    readStream.on('end', () => {
      const streamedTrace = parser.getTrace();
      const readTrace = require(filename);

      const streamedLength = streamedTrace.traceEvents.length;
      const readLength = readTrace.traceEvents.length;
      assert.equal(streamedLength, readLength);
      assert.deepStrictEqual(streamedTrace.traceEvents[0], readTrace.traceEvents[0]);
      assert.deepStrictEqual(
        streamedTrace.traceEvents[streamedLength -1],
        readTrace.traceEvents[streamedLength -1]);

      done();
    });
  });


  it('parses a trace > 256mb (slow)', () => {
    // FYI: this trace doesn't have a traceEvents property ;)
    const events = require('../../fixtures/traces/devtools-homepage-w-screenshots-trace.json');

    const stripOuterBrackets = str => str.replace(/^\[/, '').replace(/\]$/, '');
    const partialEventsStr = events => stripOuterBrackets(JSON.stringify(events));

    const traceEventsStr = partialEventsStr(events.slice(0, events.length-2)) + ',';
    const parser = new traceJson.TraceParser();

    // read the trace intro
    parser.parseChunk(`{"traceEvents": [${traceEventsStr}`);
    let bytesRead = traceEventsStr.length;

    // just keep reading until we've gone over 256 MB
    while (bytesRead < 256 * 1024 * 1024) {
      parser.parseChunk(traceEventsStr);
      bytesRead += traceEventsStr.length;
    }

    // the CPU Profiler event is last (and big), inject it just once
    const lastEventStr = partialEventsStr(events.slice(-1));
    parser.parseChunk(lastEventStr + ']}');
    bytesRead += lastEventStr.length;

    const streamedTrace = parser.getTrace();
    // assert.ok(streamedTrace.traceEvents.length > 400 * 1000);
    assert.ok(bytesRead > 256 * 1024 * 1024, `${bytesRead} bytes read`);
    // if > 256 MB are read we should have ~480,000 trace events
    assert.ok(streamedTrace.traceEvents.length > 300 * 1000, 'not >300,000 trace events');
    // big trace is ~30X larger than the original
    assert.ok(streamedTrace.traceEvents.length > events.length * 5, 'way more trace events');
  });
});
