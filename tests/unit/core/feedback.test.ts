import { describe, expect, it } from 'vitest';
import { relayHttpUrl } from '../../../src/collab/relay-host';
import { feedbackBody, feedbackProblem, MAX_MESSAGE, SEND_PROBLEMS } from '../../../src/core/feedback';

describe('feedbackProblem', () => {
  it('needs a message that is not just spaces', () => {
    expect(feedbackProblem({ message: '', email: '' })).toBe('Write a message first.');
    expect(feedbackProblem({ message: '  \n ', email: '' })).toBe('Write a message first.');
    expect(feedbackProblem({ message: 'Great tool', email: '' })).toBeNull();
  });

  it('takes an email only if it looks like one, and none at all is fine', () => {
    expect(feedbackProblem({ message: 'hi', email: 'dm@example.com' })).toBeNull();
    expect(feedbackProblem({ message: 'hi', email: '  dm@example.com ' })).toBeNull();
    expect(feedbackProblem({ message: 'hi', email: 'not an email' })).toContain("doesn't look right");
    expect(feedbackProblem({ message: 'hi', email: 'a@b' })).toContain("doesn't look right");
    expect(feedbackProblem({ message: 'hi', email: `${'x'.repeat(200)}@example.com` })).not.toBeNull();
  });
});

describe('feedbackBody', () => {
  const context = { version: '0.12.0', screen: '1280x720', page: 'editor' as const };

  it('is the message and email tidied, what helps to read them, and where it came from', () => {
    const body = JSON.parse(feedbackBody({ message: '  Hello  ', email: ' dm@example.com ' }, context));
    expect(body).toEqual({
      message: 'Hello',
      email: 'dm@example.com',
      website: '',
      version: '0.12.0',
      screen: '1280x720',
      page: 'editor',
    });
  });

  it('cuts a long message to the limit and carries the hidden field as it was filled in', () => {
    const body = JSON.parse(
      feedbackBody({ message: 'x'.repeat(MAX_MESSAGE + 500), email: '', website: 'spam' }, context),
    );
    expect(body.message).toHaveLength(MAX_MESSAGE);
    expect(body.website).toBe('spam');
  });

  it('carries the map only when there is one', () => {
    expect(
      JSON.parse(feedbackBody({ message: 'hi', email: '' }, { ...context, map: null })),
    ).not.toHaveProperty('map');
    expect(JSON.parse(feedbackBody({ message: 'hi', email: '' }, { ...context, map: '{"a":1}' })).map).toBe(
      '{"a":1}',
    );
  });
});

describe('what to say when it could not be sent', () => {
  it('has a plain message for each way it can fail', () => {
    for (const key of ['not-set-up', 'busy', 'failed'] as const)
      expect(SEND_PROBLEMS[key].length).toBeGreaterThan(10);
  });
});

describe('relayHttpUrl', () => {
  it('is http for a relay on this machine and https for any other', () => {
    expect(relayHttpUrl('localhost:8787', '/feedback')).toBe('http://localhost:8787/feedback');
    expect(relayHttpUrl('127.0.0.1:8787', '/feedback')).toBe('http://127.0.0.1:8787/feedback');
    expect(relayHttpUrl('inkstone.me.workers.dev', '/feedback')).toBe(
      'https://inkstone.me.workers.dev/feedback',
    );
    expect(relayHttpUrl('localhost.evil.example', '/feedback')).toBe(
      'https://localhost.evil.example/feedback',
    );
  });
});
