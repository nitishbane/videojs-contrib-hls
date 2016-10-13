import Playlist from '../src/playlist';
import PlaylistLoader from '../src/playlist-loader';
import QUnit from 'qunit';
import xhrFactory from '../src/xhr';
import { useFakeEnvironment } from './test-helpers';

QUnit.module('Playlist Duration');

QUnit.test('total duration for live playlists is Infinity', function() {
  let duration = Playlist.duration({
    segments: [{
      duration: 4,
      uri: '0.ts'
    }]
  });

  QUnit.equal(duration, Infinity, 'duration is infinity');
});

QUnit.module('Playlist Interval Duration');

QUnit.test('accounts for non-zero starting VOD media sequences', function() {
  let duration = Playlist.duration({
    mediaSequence: 10,
    endList: true,
    segments: [{
      duration: 10,
      uri: '0.ts'
    }, {
      duration: 10,
      uri: '1.ts'
    }, {
      duration: 10,
      uri: '2.ts'
    }, {
      duration: 10,
      uri: '3.ts'
    }]
  });

  QUnit.equal(duration, 4 * 10, 'includes only listed segments');
});

QUnit.test('uses timeline values when available', function() {
  let duration = Playlist.duration({
    mediaSequence: 0,
    endList: true,
    segments: [{
      start: 0,
      uri: '0.ts'
    }, {
      duration: 10,
      end: 2 * 10 + 2,
      uri: '1.ts'
    }, {
      duration: 10,
      end: 3 * 10 + 2,
      uri: '2.ts'
    }, {
      duration: 10,
      end: 4 * 10 + 2,
      uri: '3.ts'
    }]
  }, 4);

  QUnit.equal(duration, 4 * 10 + 2, 'used timeline values');
});

QUnit.test('works when partial timeline information is available', function() {
  let duration = Playlist.duration({
    mediaSequence: 0,
    endList: true,
    segments: [{
      start: 0,
      uri: '0.ts'
    }, {
      duration: 9,
      uri: '1.ts'
    }, {
      duration: 10,
      uri: '2.ts'
    }, {
      duration: 10,
      start: 30.007,
      end: 40.002,
      uri: '3.ts'
    }, {
      duration: 10,
      end: 50.0002,
      uri: '4.ts'
    }]
  }, 5);

  QUnit.equal(duration, 50.0002, 'calculated with mixed intervals');
});

QUnit.test('uses timeline values for the expired duration of live playlists', function() {
  let playlist = {
    mediaSequence: 12,
    segments: [{
      duration: 10,
      end: 120.5,
      uri: '0.ts'
    }, {
      duration: 9,
      uri: '1.ts'
    }]
  };
  let duration;

  duration = Playlist.duration(playlist, playlist.mediaSequence);
  QUnit.equal(duration, 110.5, 'used segment end time');
  duration = Playlist.duration(playlist, playlist.mediaSequence + 1);
  QUnit.equal(duration, 120.5, 'used segment end time');
  duration = Playlist.duration(playlist, playlist.mediaSequence + 2);
  QUnit.equal(duration, 120.5 + 9, 'used segment end time');
});

QUnit.test('looks outside the queried interval for live playlist timeline values',
function() {
  let playlist = {
    mediaSequence: 12,
    segments: [{
      duration: 10,
      uri: '0.ts'
    }, {
      duration: 9,
      end: 120.5,
      uri: '1.ts'
    }]
  };
  let duration;

  duration = Playlist.duration(playlist, playlist.mediaSequence);
  QUnit.equal(duration, 120.5 - 9 - 10, 'used segment end time');
});

QUnit.test('ignores discontinuity sequences later than the end', function() {
  let duration = Playlist.duration({
    mediaSequence: 0,
    discontinuityStarts: [1, 3],
    segments: [{
      duration: 10,
      uri: '0.ts'
    }, {
      discontinuity: true,
      duration: 9,
      uri: '1.ts'
    }, {
      duration: 10,
      uri: '2.ts'
    }, {
      discontinuity: true,
      duration: 10,
      uri: '3.ts'
    }]
  }, 2);

  QUnit.equal(duration, 19, 'excluded the later segments');
});

QUnit.test('handles trailing segments without timeline information', function() {
  let duration;
  let playlist = {
    mediaSequence: 0,
    endList: true,
    segments: [{
      start: 0,
      end: 10.5,
      uri: '0.ts'
    }, {
      duration: 9,
      uri: '1.ts'
    }, {
      duration: 10,
      uri: '2.ts'
    }, {
      start: 29.45,
      end: 39.5,
      uri: '3.ts'
    }]
  };

  duration = Playlist.duration(playlist, 3);
  QUnit.equal(duration, 29.45, 'calculated duration');

  duration = Playlist.duration(playlist, 2);
  QUnit.equal(duration, 19.5, 'calculated duration');
});

QUnit.test('uses timeline intervals when segments have them', function() {
  let duration;
  let playlist = {
    mediaSequence: 0,
    segments: [{
      start: 0,
      end: 10,
      uri: '0.ts'
    }, {
      duration: 9,
      uri: '1.ts'
    }, {
      start: 20.1,
      end: 30.1,
      duration: 10,
      uri: '2.ts'
    }]
  };

  duration = Playlist.duration(playlist, 2);
  QUnit.equal(duration, 20.1, 'used the timeline-based interval');

  duration = Playlist.duration(playlist, 3);
  QUnit.equal(duration, 30.1, 'used the timeline-based interval');
});

QUnit.test('counts the time between segments as part of the earlier segment\'s duration',
function() {
  let duration = Playlist.duration({
    mediaSequence: 0,
    endList: true,
    segments: [{
      start: 0,
      end: 10,
      uri: '0.ts'
    }, {
      start: 10.1,
      end: 20.1,
      duration: 10,
      uri: '1.ts'
    }]
  }, 1);

  QUnit.equal(duration, 10.1, 'included the segment gap');
});

QUnit.test('accounts for discontinuities', function() {
  let duration = Playlist.duration({
    mediaSequence: 0,
    endList: true,
    discontinuityStarts: [1],
    segments: [{
      duration: 10,
      uri: '0.ts'
    }, {
      discontinuity: true,
      duration: 10,
      uri: '1.ts'
    }]
  }, 2);

  QUnit.equal(duration, 10 + 10, 'handles discontinuities');
});

QUnit.test('a non-positive length interval has zero duration', function() {
  let playlist = {
    mediaSequence: 0,
    discontinuityStarts: [1],
    segments: [{
      duration: 10,
      uri: '0.ts'
    }, {
      discontinuity: true,
      duration: 10,
      uri: '1.ts'
    }]
  };

  QUnit.equal(Playlist.duration(playlist, 0), 0, 'zero-length duration is zero');
  QUnit.equal(Playlist.duration(playlist, 0, false), 0, 'zero-length duration is zero');
  QUnit.equal(Playlist.duration(playlist, -1), 0, 'negative length duration is zero');
});

QUnit.module('Playlist Seekable');

QUnit.test('calculates seekable time ranges from the available segments', function() {
  let playlist = {
    mediaSequence: 0,
    segments: [{
      duration: 10,
      uri: '0.ts'
    }, {
      duration: 10,
      uri: '1.ts'
    }],
    endList: true
  };
  let seekable = Playlist.seekable(playlist);

  QUnit.equal(seekable.length, 1, 'there are seekable ranges');
  QUnit.equal(seekable.start(0), 0, 'starts at zero');
  QUnit.equal(seekable.end(0), Playlist.duration(playlist), 'ends at the duration');
});

QUnit.test('master playlists have empty seekable ranges', function() {
  let seekable = Playlist.seekable({
    playlists: [{
      uri: 'low.m3u8'
    }, {
      uri: 'high.m3u8'
    }]
  });

  QUnit.equal(seekable.length, 0, 'no seekable ranges from a master playlist');
});

QUnit.test('seekable end is three target durations from the actual end of live playlists',
function() {
  let seekable = Playlist.seekable({
    mediaSequence: 0,
    segments: [{
      duration: 7,
      uri: '0.ts'
    }, {
      duration: 10,
      uri: '1.ts'
    }, {
      duration: 10,
      uri: '2.ts'
    }, {
      duration: 10,
      uri: '3.ts'
    }]
  });

  QUnit.equal(seekable.length, 1, 'there are seekable ranges');
  QUnit.equal(seekable.start(0), 0, 'starts at zero');
  QUnit.equal(seekable.end(0), 7, 'ends three target durations from the last segment');
});

QUnit.test('only considers available segments', function() {
  let seekable = Playlist.seekable({
    mediaSequence: 7,
    segments: [{
      uri: '8.ts',
      duration: 10
    }, {
      uri: '9.ts',
      duration: 10
    }, {
      uri: '10.ts',
      duration: 10
    }, {
      uri: '11.ts',
      duration: 10
    }]
  });

  QUnit.equal(seekable.length, 1, 'there are seekable ranges');
  QUnit.equal(seekable.start(0), 0, 'starts at the earliest available segment');
  QUnit.equal(seekable.end(0),
              10,
              'ends three target durations from the last available segment');
});

QUnit.test('seekable end accounts for non-standard target durations', function() {
  let seekable = Playlist.seekable({
    targetDuration: 2,
    mediaSequence: 0,
    segments: [{
      duration: 2,
      uri: '0.ts'
    }, {
      duration: 2,
      uri: '1.ts'
    }, {
      duration: 1,
      uri: '2.ts'
    }, {
      duration: 2,
      uri: '3.ts'
    }, {
      duration: 2,
      uri: '4.ts'
    }]
  });

  QUnit.equal(seekable.start(0), 0, 'starts at the earliest available segment');
  QUnit.equal(seekable.end(0),
              9 - (2 + 2 + 1),
              'allows seeking no further than three segments from the end');
});

QUnit.module('Playlist Media Index For Time', {
  beforeEach() {
    this.env = useFakeEnvironment();
    this.clock = this.env.clock;
    this.requests = this.env.requests;
    this.fakeHls = {
      xhr: xhrFactory()
    };
  },
  afterEach() {
    this.env.restore();
  }
});

QUnit.test('can get media index by playback position for non-live videos', function() {
  let media;
  let loader = new PlaylistLoader('media.m3u8', this.fakeHls);

  loader.load();

  this.requests.shift().respond(200, null,
    '#EXTM3U\n' +
    '#EXT-X-MEDIA-SEQUENCE:0\n' +
    '#EXTINF:4,\n' +
    '0.ts\n' +
    '#EXTINF:5,\n' +
    '1.ts\n' +
    '#EXTINF:6,\n' +
    '2.ts\n' +
    '#EXT-X-ENDLIST\n'
  );

  media = loader.media();

  QUnit.equal(Playlist.getMediaInfoForTime_(media, -1, 0, 0).mediaIndex, 0,
              'the index is never less than zero');
  QUnit.equal(Playlist.getMediaInfoForTime_(media, 0, 0, 0).mediaIndex, 0,
    'time zero is index zero');
  QUnit.equal(Playlist.getMediaInfoForTime_(media, 3, 0, 0).mediaIndex, 0,
    'time three is index zero');
  QUnit.equal(Playlist.getMediaInfoForTime_(media, 10, 0, 0).mediaIndex, 2,
    'time 10 is index 2');
  QUnit.equal(Playlist.getMediaInfoForTime_(media, 22, 0, 0).mediaIndex, 2,
              'time greater than the length is index 2');
});

QUnit.test('returns the lower index when calculating for a segment boundary', function() {
  let media;
  let loader = new PlaylistLoader('media.m3u8', this.fakeHls);

  loader.load();

  this.requests.shift().respond(200, null,
    '#EXTM3U\n' +
    '#EXT-X-MEDIA-SEQUENCE:0\n' +
    '#EXTINF:4,\n' +
    '0.ts\n' +
    '#EXTINF:5,\n' +
    '1.ts\n' +
    '#EXT-X-ENDLIST\n'
  );

  media = loader.media();

  QUnit.equal(Playlist.getMediaInfoForTime_(media, 4, 0, 0).mediaIndex, 0,
    'rounds down exact matches');
  QUnit.equal(Playlist.getMediaInfoForTime_(media, 3.7, 0, 0).mediaIndex, 0,
    'rounds down');
  QUnit.equal(Playlist.getMediaInfoForTime_(media, 4.5, 0, 0).mediaIndex, 1,
    'rounds up at 0.5');
});

QUnit.test(
'accounts for non-zero starting segment time when calculating media index',
function() {
  let media;
  let loader = new PlaylistLoader('media.m3u8', this.fakeHls);

  loader.load();

  this.requests.shift().respond(200, null,
    '#EXTM3U\n' +
    '#EXT-X-MEDIA-SEQUENCE:1001\n' +
    '#EXTINF:4,\n' +
    '1001.ts\n' +
    '#EXTINF:5,\n' +
    '1002.ts\n'
  );

  media = loader.media();

  QUnit.equal(
    Playlist.getMediaInfoForTime_(media, 45, 0, 150).mediaIndex,
    0,
    'expired content returns 0 for earliest segment available'
  );
  QUnit.equal(
    Playlist.getMediaInfoForTime_(media, 75, 0, 150).mediaIndex,
    0,
    'expired content returns 0 for earliest segment available'
  );
  QUnit.equal(
    Playlist.getMediaInfoForTime_(media, 0, 0, 150).mediaIndex,
    0,
    'time of 0 with no expired time returns first segment'
  );
  QUnit.equal(
    Playlist.getMediaInfoForTime_(media, 50 + 100, 0, 150).mediaIndex,
    0,
    'calculates the earliest available position'
  );
  QUnit.equal(
    Playlist.getMediaInfoForTime_(media, 50 + 100 + 2, 0, 150).mediaIndex,
    0,
    'calculates within the first segment'
  );
  QUnit.equal(
    Playlist.getMediaInfoForTime_(media, 50 + 100 + 2, 0, 150).mediaIndex,
    0,
    'calculates within the first segment'
  );
  QUnit.equal(
    Playlist.getMediaInfoForTime_(media, 50 + 100 + 4, 0, 150).mediaIndex,
    0,
    'calculates earlier segment on exact boundary match'
  );
  QUnit.equal(
    Playlist.getMediaInfoForTime_(media, 50 + 100 + 4.5, 0, 150).mediaIndex,
    1,
    'calculates within the second segment'
  );
  QUnit.equal(
    Playlist.getMediaInfoForTime_(media, 50 + 100 + 6, 0, 150).mediaIndex,
    1,
    'calculates within the second segment'
  );

  QUnit.equal(
    Playlist.getMediaInfoForTime_(media, 159, 0, 150).mediaIndex,
    1,
    'returns last segment when time is equal to end of last segment'
  );
  QUnit.equal(
    Playlist.getMediaInfoForTime_(media, 160, 0, 150).mediaIndex,
    1,
    'returns last segment when time is past end of last segment'
  );
});
