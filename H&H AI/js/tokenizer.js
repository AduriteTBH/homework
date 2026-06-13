// js/tokenizer.js

window.Tokenizer = {
    totalTokensUsed: 0,
    MAX_TOKENS: 4096,
    
    // Simple heuristic: 1 token ~= 4 characters on average for English text
    countTokens: function(text) {
        if (!text) return 0;
        return Math.max(1, Math.ceil(text.length / 4));
    },
    
    processInput: function(text) {
        let tokens = this.countTokens(text);
        this.totalTokensUsed += tokens;
        this.dispatch();
        return text;
    },
    
    processOutput: function(text) {
        let tokens = this.countTokens(text);
        this.totalTokensUsed += tokens;
        this.dispatch();
    },

    dispatch: function() {
        let percentage = Math.min(100, (this.totalTokensUsed / this.MAX_TOKENS) * 100);
        window.dispatchEvent(new CustomEvent('tokensUpdated', { 
            detail: { 
                total: this.totalTokensUsed,
                max: this.MAX_TOKENS,
                percentage: percentage
            } 
        }));
    }
};
