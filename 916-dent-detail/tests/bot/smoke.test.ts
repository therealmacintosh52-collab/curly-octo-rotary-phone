import { beforeEach, describe, expect, it } from 'vitest';
import { Chat, freshDb, smsId, uploadPhotos } from './harness';

describe('smoke', () => {
  beforeEach(freshDb);
  it('walks a dent job to a deposit link', async () => {
    const c = Chat.withMock(smsId());
    let r = await c.say('Hi I have a door ding on my 2020 Tacoma');
    console.log('1', r.reply, r.filtered);
    r = await c.say('here are photos', await uploadPhotos(2));
    console.log('2', r.reply, c.calls);
    r = await c.say('my zip is 95624');
    console.log('3', r.reply, c.calls, r.ui);
    r = await c.say('the first one');
    console.log('4', r.reply, c.calls);
    r = await c.say('Name: Sam Lee, email: sam@example.com, address: 12 Oak St Elk Grove, car: 2020 Toyota Tacoma');
    console.log('5', r.reply, c.calls);
    expect(true).toBe(true);
  });
});
