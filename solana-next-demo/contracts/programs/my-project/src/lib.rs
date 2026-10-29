use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Gc2iWWEfCWHLvTvimc1gUJo4XxX6EgMc5tMArLUFEpBc");

/**
 * Solana质押程序 - HHF代币质押
 * 
 * 程序架构说明：
 * 1. 质押池账户（StakePool）：存储全局质押池状态，是一个PDA账户
 * 2. 用户质押账户（UserStake）：每个用户一个PDA，存储用户的质押信息
 * 3. 质押代币账户（stake_token_account）：存储用户质押的HHF代币
 * 4. 利息池代币账户（interest_token_account）：存储用于支付利息的HHF代币
 * 
 * 利息计算：
 * - 每分钟0.1%的利息
 * - 利息 = 本金 * 0.001 * 分钟数
 */

#[program]
pub mod my_project {
    use super::*;

    /**
     * 初始化质押池
     * 
     * 这个函数会：
     * 1. 创建一个质押池PDA账户，存储全局状态
     * 2. 设置利息池的代币账户（用于支付利息）
     * 3. 设置质押代币账户（存储用户质押的代币）
     * 4. 设置代币mint地址（HHF代币）
     * 
     * 注意：
     * - interest_token_account和stake_token_account需要预先创建
     * - 这两个代币账户的authority必须是stake_pool PDA
     * - 在部署脚本中会创建这些账户
     */
    pub fn initialize(
        ctx: Context<Initialize>,
        token_mint: Pubkey,
    ) -> Result<()> {
        let stake_pool = &mut ctx.accounts.stake_pool;
        
        // 验证代币账户的mint是否正确
        require!(
            ctx.accounts.interest_token_account.mint == token_mint,
            StakeError::InvalidTokenMint
        );
        require!(
            ctx.accounts.stake_token_account.mint == token_mint,
            StakeError::InvalidTokenMint
        );
        
        // 设置质押池的基本信息
        stake_pool.authority = ctx.accounts.authority.key();
        stake_pool.token_mint = token_mint;
        stake_pool.interest_token_account = ctx.accounts.interest_token_account.key();
        stake_pool.stake_token_account = ctx.accounts.stake_token_account.key();
        stake_pool.total_staked = 0;
        stake_pool.bump = ctx.bumps.stake_pool;
        
        msg!("质押池初始化成功！");
        msg!("管理员: {}", stake_pool.authority);
        msg!("代币Mint: {}", stake_pool.token_mint);
        msg!("利息池账户: {}", stake_pool.interest_token_account);
        msg!("质押代币账户: {}", stake_pool.stake_token_account);
        
        Ok(())
    }

    /**
     * 质押HHF代币
     * 
     * 流程：
     * 1. 从用户的代币账户转移HHF代币到程序的质押代币账户
     * 2. 创建或更新用户的质押记录（PDA账户）
     * 3. 记录质押时间和金额
     * 4. 更新质押池的总质押量
     * 
     * 参数说明：
     * - user: 质押的用户
     * - amount: 质押的HHF代币数量
     */
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        let user_stake = &mut ctx.accounts.user_stake;
        let stake_pool = &mut ctx.accounts.stake_pool;
        
        // 如果用户已经有质押记录，需要先计算并更新已产生的利息
        if user_stake.staked_amount > 0 {
            // 计算从上次更新到现在的利息
            let current_time = Clock::get()?.unix_timestamp;
            let minutes_elapsed = (current_time - user_stake.last_update_time) / 60;
            
            if minutes_elapsed > 0 {
                // 计算利息：本金 * 0.001 * 分钟数
                let interest = user_stake.staked_amount
                    .checked_mul(minutes_elapsed as u64)
                    .and_then(|x| x.checked_div(1000))
                    .ok_or(StakeError::MathOverflow)?;
                
                user_stake.accrued_interest = user_stake.accrued_interest
                    .checked_add(interest)
                    .ok_or(StakeError::MathOverflow)?;
            }
        }
        
        // 转移代币：从用户的代币账户转移到程序的质押代币账户
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.stake_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;
        
        // 更新用户质押记录
        if user_stake.staked_amount == 0 {
            // 首次质押，初始化记录
            user_stake.user = ctx.accounts.user.key();
            user_stake.stake_pool = stake_pool.key();
            user_stake.staked_amount = amount;
            user_stake.stake_time = Clock::get()?.unix_timestamp;
            user_stake.last_update_time = Clock::get()?.unix_timestamp;
            user_stake.accrued_interest = 0;
            user_stake.bump = ctx.bumps.user_stake;
        } else {
            // 追加质押
            user_stake.staked_amount = user_stake.staked_amount
                .checked_add(amount)
                .ok_or(StakeError::MathOverflow)?;
            user_stake.last_update_time = Clock::get()?.unix_timestamp;
        }
        
        // 更新质押池总质押量
        stake_pool.total_staked = stake_pool.total_staked
            .checked_add(amount)
            .ok_or(StakeError::MathOverflow)?;
        
        msg!("质押成功！金额: {}", amount);
        msg!("用户总质押: {}", user_stake.staked_amount);
        msg!("质押池总质押: {}", stake_pool.total_staked);
        
        Ok(())
    }

    /**
     * 领取利息（只领取利息，不领取本金）
     * 
     * 流程：
     * 1. 计算从上次更新到现在的利息
     * 2. 从利息池代币账户转移利息到用户的代币账户
     * 3. 更新用户的利息记录
     * 
     * 注意：利息从利息池账户（interest_token_account）发放
     */
    pub fn claim_interest(ctx: Context<ClaimInterest>) -> Result<()> {
        let user_stake = &mut ctx.accounts.user_stake;
        let stake_pool = &ctx.accounts.stake_pool;
        
        // 检查用户是否有质押
        require!(user_stake.staked_amount > 0, StakeError::NoStake);
        
        // 计算从上次更新到现在的利息
        let current_time = Clock::get()?.unix_timestamp;
        let minutes_elapsed = (current_time - user_stake.last_update_time) / 60;
        
        // 计算新产生的利息：本金 * 0.001 * 分钟数
        let new_interest = if minutes_elapsed > 0 {
            user_stake.staked_amount
                .checked_mul(minutes_elapsed as u64)
                .and_then(|x| x.checked_div(1000))
                .ok_or(StakeError::MathOverflow)?
        } else {
            0
        };
        
        // 总利息 = 已累计利息 + 新产生的利息
        let total_interest = user_stake.accrued_interest
            .checked_add(new_interest)
            .ok_or(StakeError::MathOverflow)?;
        
        require!(total_interest > 0, StakeError::NoInterest);
        
        // 检查利息池是否有足够的代币
        let interest_token_account = &ctx.accounts.interest_token_account;
        require!(
            interest_token_account.amount >= total_interest,
            StakeError::InsufficientInterestFunds
        );
        
        // 从利息池转移利息到用户账户
        // 注意：利息池账户的authority是stake_pool PDA，所以使用PDA签名
        let bump = stake_pool.bump;
        let seeds = &[
            b"stake_pool",
            &[bump][..],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.interest_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.stake_pool_account.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, total_interest)?;
        
        // 更新用户记录：清零已累计利息，更新最后更新时间
        user_stake.accrued_interest = 0;
        user_stake.last_update_time = current_time;
        
        msg!("领取利息成功！金额: {}", total_interest);
        
        Ok(())
    }

    /**
     * 全部领取（领取利息+本金）
     * 
     * 流程：
     * 1. 计算从上次更新到现在的利息
     * 2. 从利息池转移利息到用户账户
     * 3. 从质押代币账户转移本金到用户账户
     * 4. 清零用户的质押记录
     * 5. 更新质押池的总质押量
     */
    pub fn claim_all(ctx: Context<ClaimAll>) -> Result<()> {
        let user_stake = &mut ctx.accounts.user_stake;
        let stake_pool = &mut ctx.accounts.stake_pool;
        
        // 检查用户是否有质押
        require!(user_stake.staked_amount > 0, StakeError::NoStake);
        
        // 计算从上次更新到现在的利息
        let current_time = Clock::get()?.unix_timestamp;
        let minutes_elapsed = (current_time - user_stake.last_update_time) / 60;
        
        // 计算新产生的利息
        let new_interest = if minutes_elapsed > 0 {
            user_stake.staked_amount
                .checked_mul(minutes_elapsed as u64)
                .and_then(|x| x.checked_div(1000))
                .ok_or(StakeError::MathOverflow)?
        } else {
            0
        };
        
        // 总利息
        let total_interest = user_stake.accrued_interest
            .checked_add(new_interest)
            .ok_or(StakeError::MathOverflow)?;
        
        let principal = user_stake.staked_amount;
        
        // 如果有利息，从利息池转移利息
        if total_interest > 0 {
            // 检查利息池是否有足够的代币
            require!(
                ctx.accounts.interest_token_account.amount >= total_interest,
                StakeError::InsufficientInterestFunds
            );
            
            // 从利息池转移利息到用户账户
            // 注意：利息池账户的authority是stake_pool PDA，所以使用PDA签名
            let bump = stake_pool.bump;
            let seeds = &[
                b"stake_pool",
                &[bump][..],
            ];
            let signer = &[&seeds[..]];
            
            let cpi_accounts = Transfer {
                from: ctx.accounts.interest_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.stake_pool_account.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::transfer(cpi_ctx, total_interest)?;
        }
        
        // 从质押代币账户转移本金到用户账户
        let bump = stake_pool.bump;
        let seeds = &[
            b"stake_pool",
            &[bump][..],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.stake_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.stake_pool_account.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, principal)?;
        
        // 更新质押池总质押量
        stake_pool.total_staked = stake_pool.total_staked
            .checked_sub(principal)
            .ok_or(StakeError::MathOverflow)?;
        
        // 清零用户质押记录
        user_stake.staked_amount = 0;
        user_stake.accrued_interest = 0;
        user_stake.last_update_time = current_time;
        
        msg!("全部领取成功！本金: {}, 利息: {}", principal, total_interest);
        msg!("质押池剩余总质押: {}", stake_pool.total_staked);
        
        Ok(())
    }
}

/**
 * 初始化质押池的账户结构
 */
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>, // 质押池的管理员
    
    #[account(
        init,
        payer = authority,
        space = 8 + StakePool::LEN,
        seeds = [b"stake_pool"],
        bump
    )]
    pub stake_pool: Account<'info, StakePool>, // 质押池PDA账户
    
    /// CHECK: 利息池代币账户，需要预先创建并存入HHF代币用于支付利息
    /// 这个账户的authority必须是stake_pool的PDA
    #[account(mut)]
    pub interest_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: 质押代币账户，存储用户质押的HHF代币
    /// 这个账户的authority必须是stake_pool的PDA
    #[account(mut)]
    pub stake_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/**
 * 质押的账户结构
 */
#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>, // 质押的用户
    
    #[account(mut)]
    pub stake_pool: Account<'info, StakePool>, // 质押池账户
    
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserStake::LEN,
        seeds = [b"user_stake", user.key().as_ref(), stake_pool.key().as_ref()],
        bump
    )]
    pub user_stake: Account<'info, UserStake>, // 用户质押记录PDA账户
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>, // 用户的HHF代币账户
    
    /// CHECK: 程序的质押代币账户，存储所有用户质押的HHF代币
    /// 验证：确保这个账户地址与stake_pool中存储的地址匹配
    #[account(
        mut,
        address = stake_pool.stake_token_account @ StakeError::InvalidTokenAccount
    )]
    pub stake_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/**
 * 领取利息的账户结构
 */
#[derive(Accounts)]
pub struct ClaimInterest<'info> {
    #[account(mut)]
    pub user: Signer<'info>, // 领取利息的用户
    
    #[account(
        mut,
        seeds = [b"stake_pool"],
        bump = stake_pool.bump
    )]
    pub stake_pool: Account<'info, StakePool>, // 质押池账户
    
    #[account(
        mut,
        seeds = [b"user_stake", user.key().as_ref(), stake_pool.key().as_ref()],
        bump = user_stake.bump
    )]
    pub user_stake: Account<'info, UserStake>, // 用户质押记录
    
    /// CHECK: 质押池PDA账户，用作签名者（用于从利息池转移代币）
    #[account(
        seeds = [b"stake_pool"],
        bump = stake_pool.bump
    )]
    pub stake_pool_account: AccountInfo<'info>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>, // 用户的HHF代币账户（接收利息）
    
    /// CHECK: 利息池代币账户，从这里发放利息
    /// 验证：确保这个账户地址与stake_pool中存储的地址匹配
    /// 注意：这个账户的authority是stake_pool PDA，程序可以自动支付利息
    #[account(
        mut,
        address = stake_pool.interest_token_account @ StakeError::InvalidTokenAccount
    )]
    pub interest_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

/**
 * 全部领取的账户结构
 */
#[derive(Accounts)]
pub struct ClaimAll<'info> {
    #[account(mut)]
    pub user: Signer<'info>, // 领取的用户
    
    #[account(
        mut,
        seeds = [b"stake_pool"],
        bump = stake_pool.bump
    )]
    pub stake_pool: Account<'info, StakePool>, // 质押池账户
    
    #[account(
        mut,
        seeds = [b"user_stake", user.key().as_ref(), stake_pool.key().as_ref()],
        bump = user_stake.bump
    )]
    pub user_stake: Account<'info, UserStake>, // 用户质押记录
    
    /// CHECK: 质押池PDA账户，用作签名者（用于从质押代币账户和利息池账户转移代币）
    #[account(
        seeds = [b"stake_pool"],
        bump = stake_pool.bump
    )]
    pub stake_pool_account: AccountInfo<'info>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>, // 用户的HHF代币账户（接收本金+利息）
    
    /// CHECK: 程序的质押代币账户，从这里返还本金
    /// 验证：确保这个账户地址与stake_pool中存储的地址匹配
    /// 注意：这个账户的authority是stake_pool PDA
    #[account(
        mut,
        address = stake_pool.stake_token_account @ StakeError::InvalidTokenAccount
    )]
    pub stake_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: 利息池代币账户，从这里发放利息
    /// 验证：确保这个账户地址与stake_pool中存储的地址匹配
    /// 注意：这个账户的authority是stake_pool PDA，程序可以自动支付利息
    #[account(
        mut,
        address = stake_pool.interest_token_account @ StakeError::InvalidTokenAccount
    )]
    pub interest_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

/**
 * 质押池状态账户
 * 存储全局质押池信息
 */
#[account]
pub struct StakePool {
    pub authority: Pubkey,              // 管理员地址
    pub token_mint: Pubkey,              // HHF代币的mint地址
    pub interest_token_account: Pubkey,  // 利息池代币账户地址（用于支付利息）
    pub stake_token_account: Pubkey,     // 质押代币账户地址（存储用户质押的代币）
    pub total_staked: u64,               // 总质押量
    pub bump: u8,                        // PDA bump seed
}

impl StakePool {
    pub const LEN: usize = 32 + 32 + 32 + 32 + 8 + 1; // authority + token_mint + interest_token_account + stake_token_account + total_staked + bump
}

/**
 * 用户质押记录账户
 * 每个用户一个PDA账户，存储用户的质押信息
 */
#[account]
pub struct UserStake {
    pub user: Pubkey,           // 用户地址
    pub stake_pool: Pubkey,     // 质押池地址
    pub staked_amount: u64,     // 质押金额
    pub stake_time: i64,        // 首次质押时间（Unix时间戳）
    pub last_update_time: i64,  // 最后更新时间（Unix时间戳）
    pub accrued_interest: u64,  // 已累计但未领取的利息
    pub bump: u8,               // PDA bump seed
}

impl UserStake {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 8 + 8 + 1; // user + stake_pool + staked_amount + stake_time + last_update_time + accrued_interest + bump
}

/**
 * 错误类型定义
 */
#[error_code]
pub enum StakeError {
    #[msg("数学运算溢出")]
    MathOverflow,
    #[msg("用户没有质押")]
    NoStake,
    #[msg("没有可领取的利息")]
    NoInterest,
    #[msg("利息池资金不足")]
    InsufficientInterestFunds,
    #[msg("代币mint不匹配")]
    InvalidTokenMint,
    #[msg("代币账户地址不匹配")]
    InvalidTokenAccount,
}

