var should = require('should');
var jspf = require('../index.js');

describe("Track Methods", function() {
	it("Can create Track", function(done) {
		var t = new jspf.Track();
		var t2 = new jspf.Track();
		t2.isTrack(t).should.equal(true);
		done();
	});
	it("Created Track is parsable", function(done) {
		var t = new jspf.Track();
		var t2 = new jspf.Track();
		t2.parsable(t).should.equal(true);
		done();
	});
	it("Created Track toString methods return a JSON parsable object", function(done) {
		var t = new jspf.Track();
		var t2 = new jspf.Track();
                t2.parsable(JSON.parse(t.toString())).should.equal(true);
		done();
	});	
	it("Can modify Track extension with a valid extension Object and get it with the getter", function(done) {
		var t = new jspf.Track();
		t.setExtension({'foo': 'foo'}).should.equal(true);
		t.extension.should.be.instanceOf(Object).and.have.property('foo').which.is.equal('foo');
		t.getExtension().should.be.instanceOf(Object).and.have.property('foo').which.is.equal('foo');
		done();
	});
	it("Can't modify Track extension with anything else", function(done) {
		var t = new jspf.Track();
		t.setExtension("Foo").should.equal(false);
		t.extension.should.be.instanceOf(Object).and.not.have.property('foo');
		done();
	});
	it("Can modify Track meta with a valid meta Array and get it with the getter", function(done) {
		var t = new jspf.Track();
		t.setMeta(["foo", "foo2"]).should.equal(true);
		t.meta.should.be.instanceOf(Array).with.lengthOf(2);
		t.meta[0].should.equal("foo");
		t.meta[1].should.equal("foo2");
		t.getMeta().should.be.instanceOf(Array).with.lengthOf(2);
		t.getMeta()[0].should.equal("foo");
                t.getMeta()[1].should.equal("foo2");
		done();
	});
	it("Can't modify Track meta with anything else", function(done) {
		var t = new jspf.Track();
		t.setMeta("Foo").should.equal(false);
		t.meta.should.be.instanceOf(Array).with.lengthOf(0);
		done();
	});
	it("Can modify Track link with a valid link Array and get it with the getter", function(done) {
		var t = new jspf.Track();
		t.setLink(["foo", "foo2"]).should.equal(true);
		t.link.should.be.instanceOf(Array).with.lengthOf(2);
		t.link[0].should.equal("foo");
		t.link[1].should.equal("foo2");
		t.getLink().should.be.instanceOf(Array).with.lengthOf(2);
		t.getLink()[0].should.equal("foo");
                t.getLink()[1].should.equal("foo2");
		done();
	});
	it("Can't modify Track link with anything else", function(done) {
		var t = new jspf.Track();
		t.setLink("Foo").should.equal(false);
		t.link.should.be.instanceOf(Array).with.lengthOf(0);
		done();
	});
	it("Can modify Track duration with a valid duration length and get it with the getter", function(done) {
		var t = new jspf.Track();
		t.setDuration(154).should.equal(true);
		t.duration.should.be.a.Number.and.equal(154);
		t.getDuration().should.be.a.Number.and.equal(154);
		done();
	});
	it("Can't modify Track duration with anything else", function(done) {
		var t = new jspf.Track();
		t.setDuration("Foo").should.equal(false);
		t.duration.should.be.a.Number.and.equal(0);
		done();
	});
	it("Can modify Track trackNum with a valid track number and get it with the getter", function(done) {
		var t = new jspf.Track();
		t.setTrackNum(14).should.equal(true);
		t.trackNum.should.be.a.Number.and.equal(14);
		t.getTrackNum().should.be.a.Number.and.equal(14);
		done();
	});
	it("Can't modify Track trackNum with anything else", function(done) {
		var t = new jspf.Track();
		t.setTrackNum("Foo").should.equal(false);
		t.trackNum.should.be.a.Number.and.equal(0);
		done();
	});
	it("Can modify Track album with a valid album name and get it with the getter", function(done) {
		var t = new jspf.Track();
		t.setAlbum("Thriller").should.equal(true);
		t.album.should.be.a.String.and.equal("Thriller");
		t.getAlbum().should.be.a.String.and.equal("Thriller");
		done();
	});
	it("Can't modify Track album with anything else", function(done) {
		var t = new jspf.Track();
		t.setAlbum({"Foo": "Foo"}).should.equal(false);
		t.album.should.be.a.String.and.equal("");
		done();
	});
	it("Can modify Track image with a valid image path and get it with the getter", function(done) {
		var t = new jspf.Track();
		t.setImage("http://google.com/favico.ico").should.equal(true);
		t.image.should.be.a.String.and.equal("http://google.com/favico.ico");
		t.getImage().should.be.a.String.and.equal("http://google.com/favico.ico");
		done();
	});
	it("Can't modify Track image with anything else", function(done) {
		var t = new jspf.Track();
		t.setImage({"Foo": "Foo"}).should.equal(false);
		t.image.should.be.a.String.and.equal("");
		done();
	});
	it("Can modify Track info with a valid info string and get it with the getter", function(done) {
		var t = new jspf.Track();
		t.setInfo("This track is super!").should.equal(true);
		t.info.should.be.a.String.and.equal("This track is super!");
		t.getInfo().should.be.a.String.and.equal("This track is super!");
		done();
	});
	it("Can't modify Track info with anything else", function(done) {
		var t = new jspf.Track();
		t.setInfo({"Foo": "Foo"}).should.equal(false);
		t.info.should.be.a.String.and.equal("");
		done();
	});
	it("Can modify Track annotation with a valid annotation string and get it with the getter", function(done) {
		var t = new jspf.Track();
		t.setAnnotation("This track is super!").should.equal(true);
		t.annotation.should.be.a.String.and.equal("This track is super!");
		t.getAnnotation().should.be.a.String.and.equal("This track is super!");
		done();
	});
	it("Can't modify Track annotation with anything else", function(done) {
		var t = new jspf.Track();
		t.setAnnotation({"Foo": "Foo"}).should.equal(false);
		t.annotation.should.be.a.String.and.equal("");
		done();
	});
	it("Can modify Track creator with a valid creator name and get it with the getter", function(done) {
		var t = new jspf.Track();
		t.setCreator("Mickael Jackson").should.equal(true);
		t.creator.should.be.a.String.and.equal("Mickael Jackson");
		t.getCreator().should.be.a.String.and.equal("Mickael Jackson");
		done();
	});
	it("Can't modify Track creator with anything else", function(done) {
		var t = new jspf.Track();
		t.setCreator({"Foo": "Foo"}).should.equal(false);
		t.creator.should.be.a.String.and.equal("");
		done();
	});
	it("Can modify Track title with a valid title name and get it with the getter", function(done) {
		var t = new jspf.Track();
		t.setTitle("Thriller").should.equal(true);
		t.title.should.be.a.String.and.equal("Thriller");
		t.getTitle().should.be.a.String.and.equal("Thriller");
		done();
	});
	it("Can't modify Track title with anything else", function(done) {
		var t = new jspf.Track();
		t.setTitle({"Foo": "Foo"}).should.equal(false);
		t.title.should.be.a.String.and.equal("");
		done();
	});
	it("Can modify Track identifier with a valid identifier string and get it with the getter", function(done) {
		var t = new jspf.Track();
		t.setIdentifier("ABCDEFG").should.equal(true);
		t.identifier.should.be.a.String.and.equal("ABCDEFG");
		t.getIdentifier().should.be.a.String.and.equal("ABCDEFG");
		done();
	});
	it("Can't modify Track identifier with anything else", function(done) {
		var t = new jspf.Track();
		t.setIdentifier({"Foo": "Foo"}).should.equal(false);
		t.identifier.should.be.a.String.and.equal("");
		done();
	});
	it("Can modify Track location with a valid location and get it with the getter", function(done) {
		var t = new jspf.Track();
		t.setLocation("whereever").should.equal(true);
		t.location.should.be.a.String.and.equal("whereever");
		t.getLocation().should.be.a.String.and.equal("whereever");
		done();
	});
	it("Can't modify Track title with anything else", function(done) {
		var t = new jspf.Track();
		t.setLocation({"Foo": "Foo"}).should.equal(false);
		t.location.should.be.a.String.and.equal("");
		done();
	});
	it("Can compare two tracks", function(done) {
		var t = new jspf.Track();
		var t2 = new jspf.Track();
		t.compare(t2).should.equal(true);
		t2.setTitle("Thriller");
		t.compare(t2).should.equal(false);
		done();
	});
});

describe("Jsfp Methods", function() {
	it("Can create Jspf", function(done) {
		var j = new jspf.Jspf();
		var j2 = new jspf.Jspf();
		j2.isJspf(j).should.equal(true);
		done();
	});
	it("Can remove a track from the Track list", function(done) {
		var j = new jspf.Jspf();
		var t = new jspf.Track();
		t.setTitle("Thriller");
		var t2 = new jspf.Track();
		t2.setTitle("Beat it");
		j.pushTrack(t);
		j.pushTrack(t2);
		j.track.length.should.equal(2);
		j.track[0].getTitle().should.equal("Thriller");
		j.track[1].getTitle().should.equal("Beat it");
		j.removeTrack(t);
		j.track.length.should.equal(1);
		j.track[0].getTitle().should.equal("Beat it");
		done();
	});
});
