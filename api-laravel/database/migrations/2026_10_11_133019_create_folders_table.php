<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('folders', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // 0 is the root sentinel. NULL would defeat the unique index below,
            // because MySQL treats every NULL as distinct.
            $table->unsignedBigInteger('parent_id')->default(0);
            $table->string('name', 120);
            $table->char('color', 7)->nullable();
            $table->integer('position')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'parent_id', 'name']);
            $table->index(['user_id', 'parent_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('folders');
    }
};
