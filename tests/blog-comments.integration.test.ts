import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, after } from 'node:test';
import { prisma } from '../lib/prisma';
import { getPublicComments } from '../lib/blog-comments';

class Rollback extends Error {}
test('public comments preserve moderation, privacy, reply visibility and pagination', async () => {
try {
  await prisma.$transaction(async tx => {
    const post = await tx.post.create({data:{title:'Isolated comment verification',slug:`comment-check-${randomUUID()}`,status:'draft'}});
    const data = (body:string,status:string,parentId?:string) => ({postId:post.id,authorName:'Verification reader',authorEmail:'comment-verification@example.com',body,status,parentId,requestKey:randomUUID()});
    const approved = await tx.postComment.create({data:data('Approved root','approved')});
    const hidden = await tx.postComment.create({data:data('Rejected root','rejected')});
    await tx.postComment.create({data:data('Pending root','pending')});
    await tx.postComment.create({data:data('Approved reply','approved',approved.id)});
    await tx.postComment.create({data:data('Pending reply','pending',approved.id)});
    await tx.postComment.create({data:data('Hidden reply','approved',hidden.id)});
    let result = await getPublicComments(post.id,undefined,tx);
    assert.equal(result.count,2);
    assert.equal(result.comments.length,1);
    assert.equal(result.comments[0].replies.length,1);
    assert.ok(!JSON.stringify(result).includes('authorEmail'));
    assert.ok(!JSON.stringify(result).includes('comment-verification@example.com'));
    assert.ok(!JSON.stringify(result).includes('Pending'));
    assert.ok(!JSON.stringify(result).includes('Hidden reply'));
    await tx.postComment.update({where:{id:approved.id},data:{status:'rejected'}});
    result = await getPublicComments(post.id,undefined,tx);
    assert.equal(result.count,0);
    await tx.postComment.delete({where:{id:approved.id}});
    assert.equal(await tx.postComment.count({where:{parentId:approved.id}}),0);
    await tx.postComment.createMany({data:Array.from({length:21},(_,i)=>data(`Pagination ${i}`,'approved'))});
    result = await getPublicComments(post.id,undefined,tx);
    assert.equal(result.comments.length,20);
    assert.ok(result.nextCursor);
    const next = await getPublicComments(post.id,result.nextCursor!,tx);
    assert.equal(next.comments.length,1);
    assert.equal(next.nextCursor,null);
    throw new Rollback();
  }, {timeout:30000});
} catch(error) { if (!(error instanceof Rollback)) throw error; }
});
after(async () => { await prisma.$disconnect(); });
